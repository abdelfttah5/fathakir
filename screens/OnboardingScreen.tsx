import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, Group } from '../types';
import { 
  createGroupInFirestore, 
  joinGroupInFirestore, 
  registerUser, 
  loginUser, 
  loginGuestUser,
  getUserGroup,
  resetPassword,
  observeAuthState
} from '../services/firebase';
import { updateProfile } from "firebase/auth";

interface OnboardingProps {
  onComplete: (user: User, group: Group) => void;
}

const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {
  // Phase: 'AUTH' (Login/Signup/QuickJoin) or 'GROUP' (Create/Join manually)
  const [phase, setPhase] = useState<'AUTH' | 'GROUP'>('AUTH');
  
  // Auth State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'JOIN_CODE'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Quick Join State
  const [quickName, setQuickName] = useState('');
  const [quickCode, setQuickCode] = useState('');
  
  // Group State
  const [groupMode, setGroupMode] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [groupName, setGroupName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  
  // General State
  const [isLoading, setIsLoading] = useState(false); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);

  // 1. Check if user is already logged in (Persistent Session)
  useEffect(() => {
    const unsubscribe = observeAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        // User is logged in
        try {
          setIsLoading(true);
          // Reconstruct User object
          const userObj: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'مستخدم',
            email: firebaseUser.email || '',
            isAdmin: false,
            isGuest: firebaseUser.isAnonymous, // It is guest if anonymous
            privacySettings: { showDetails: false, shareLocation: false }
          };
          
          setCurrentUser(userObj);

          // Check if they have a group
          const group = await getUserGroup(firebaseUser.uid);
          if (group) {
            onComplete(userObj, group);
          } else {
            // Logged in but no group -> Go to Group Phase
            setPhase('GROUP');
            setIsLoading(false);
          }
        } catch (err) {
          console.error(err);
           if (!currentUser && firebaseUser) {
              const u: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'زائر',
                email: firebaseUser.email || '',
                isAdmin: false,
                isGuest: firebaseUser.isAnonymous,
                privacySettings: { showDetails: false, shareLocation: false }
              };
              setCurrentUser(u);
           }
          setPhase('GROUP');
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const translateError = (code: string) => {
    if (code.includes('auth/email-already-in-use')) return 'البريد الإلكتروني مسجل مسبقاً';
    if (code.includes('auth/invalid-email')) return 'البريد الإلكتروني غير صحيح';
    if (code.includes('auth/user-not-found')) return 'لا يوجد حساب بهذا البريد';
    if (code.includes('auth/wrong-password')) return 'كلمة المرور غير صحيحة';
    if (code.includes('auth/weak-password')) return 'كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل)';
    return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى';
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (authMode === 'REGISTER') {
        if (!name) throw new Error("الرجاء إدخال الاسم");
        const user = await registerUser(email, password, name);
        setCurrentUser({ ...user, isGuest: false });
        setPhase('GROUP'); 

      } else if (authMode === 'LOGIN') {
        const user = await loginUser(email, password);
        setCurrentUser({ ...user, isGuest: false });
        
        // Check Group
        const group = await getUserGroup(user.id);
        if (group) {
          onComplete({ ...user, isGuest: false }, group);
        } else {
          setPhase('GROUP');
        }

      } else if (authMode === 'JOIN_CODE') {
        // QUICK JOIN FLOW
        if (!quickName.trim()) throw new Error("الرجاء إدخال الاسم");
        if (!quickCode.trim()) throw new Error("الرجاء إدخال رمز الدعوة");

        // 1. Create Anon User
        const user = await loginGuestUser();
        
        // 2. Update Name manually since Guest Login might not set it immediately in Auth object
        const updatedUser = { ...user, name: quickName };

        // 3. Join Group
        const group = await joinGroupInFirestore(quickCode, updatedUser);
        if (group) {
          onComplete(updatedUser, group);
        } else {
           throw new Error("لم يتم العثور على المجموعة");
        }
      } 
    } catch (err: any) {
      console.error(err);
      setError(translateError(err.code || err.message || err.toString()));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("أدخل البريد الإلكتروني أولاً");
      return;
    }
    try {
      await resetPassword(email);
      setSuccessMsg("تم إرسال رابط إعادة تعيين كلمة المرور.");
    } catch (e: any) {
      setError(translateError(e.code || ""));
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setError('');
    setIsLoading(true);

    try {
      let targetGroup: Group;

      if (groupMode === 'CREATE') {
        if (!groupName) throw new Error("أدخل اسم المجموعة");
        const groupId = `group_${Date.now()}`;
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const newGroup: Group = {
          id: groupId,
          name: groupName,
          timezone: 'Asia/Muscat',
          inviteCode: inviteCode
        };

        await createGroupInFirestore(newGroup, currentUser);
        targetGroup = newGroup;
        currentUser.isAdmin = true; 

      } else {
        // JOIN
        if (!inviteToken) throw new Error("أدخل رمز الدعوة");
        const foundGroup = await joinGroupInFirestore(inviteToken, currentUser);
        if (!foundGroup) throw new Error("المجموعة غير موجودة أو الرمز خاطئ");
        targetGroup = foundGroup;
      }

      onComplete(currentUser, targetGroup);

    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء إعداد المجموعة");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-slate-500">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>جاري المعالجة...</p>
          </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 text-slate-800 dir-rtl relative h-full">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-8">
        
        {/* Header Section */}
        <div className="bg-emerald-600 p-8 text-center text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
             <h1 className="text-2xl font-bold font-amiri mb-2">مجموعتي</h1>
             <p className="text-emerald-100 opacity-90 text-sm">
               {phase === 'AUTH' ? 'سجل دخولك أو انضم برمز الدعوة للتواصل مع عائلتك' : 'قم بإنشاء مجموعة أو الانضمام لأخرى'}
             </p>
          </div>
        </div>

        <div className="p-8">
          {phase === 'AUTH' && (
            <>
              {/* Auth Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => { setAuthMode('LOGIN'); setError(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${authMode === 'LOGIN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                >
                  دخول
                </button>
                <button
                  onClick={() => { setAuthMode('REGISTER'); setError(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${authMode === 'REGISTER' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                >
                  جديد
                </button>
                <button
                  onClick={() => { setAuthMode('JOIN_CODE'); setError(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${authMode === 'JOIN_CODE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                >
                  انضمام
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                
                {/* 1. REGISTER FORM */}
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">الاسم</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="اسمك الظاهر للمجموعة"
                      required
                    />
                  </div>
                )}

                {(authMode === 'REGISTER' || authMode === 'LOGIN') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">البريد الإلكتروني</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left placeholder:text-right"
                        style={{ direction: 'ltr' }}
                        placeholder="name@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                  </>
                )}

                {/* 2. JOIN CODE FORM */}
                {authMode === 'JOIN_CODE' && (
                  <>
                    <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-800 mb-4 border border-amber-100 leading-relaxed">
                      <strong>هل حصلت على رمز دعوة؟</strong><br/>
                      أدخل اسمك ورمز الدعوة للانضمام فوراً إلى المجموعة ورؤية الأعضاء الآخرين.
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">اسمك</label>
                      <input
                        type="text"
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="الاسم الذي سيظهر للعائلة"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">رمز الدعوة</label>
                      <input
                        type="text"
                        value={quickCode}
                        onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-mono tracking-widest uppercase"
                        placeholder="XYZ-123"
                        required
                      />
                    </div>
                  </>
                )}

                {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center font-bold" style={{direction: 'ltr'}}>{error}</div>}
                {successMsg && <div className="text-emerald-600 text-xs bg-emerald-50 p-3 rounded-lg">{successMsg}</div>}

                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  {authMode === 'LOGIN' ? 'دخول' : authMode === 'REGISTER' ? 'إنشاء الحساب' : 'انضمام للمجموعة'}
                </button>

                {authMode === 'LOGIN' && (
                  <button 
                    type="button"
                    onClick={handlePasswordReset}
                    className="block w-full text-center text-xs text-slate-400 mt-2 hover:text-emerald-600"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </form>
            </>
          )}

          {phase === 'GROUP' && (
            <div className="animate-fade-in">
              <h2 className="text-center font-bold text-xl mb-6">أهلاً بك، {currentUser?.name}</h2>
              
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => setGroupMode('CREATE')}
                  className={`flex-1 py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all ${groupMode === 'CREATE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}
                >
                  إنشاء مجموعة
                </button>
                <button
                  onClick={() => setGroupMode('JOIN')}
                  className={`flex-1 py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all ${groupMode === 'JOIN' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}
                >
                  انضمام لمجموعة
                </button>
              </div>

              <form onSubmit={handleGroupSubmit} className="space-y-4">
                {groupMode === 'CREATE' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">اسم المجموعة</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="مثال: أسرتي، أصحابي..."
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">رمز الدعوة</label>
                    <input
                      type="text"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value.toUpperCase())}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-mono tracking-widest uppercase"
                      placeholder="XYZ-123"
                    />
                  </div>
                )}

                {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg">{error}</div>}

                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all mt-4"
                >
                  {groupMode === 'CREATE' ? 'إنشاء وبدء' : 'انضمام'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;