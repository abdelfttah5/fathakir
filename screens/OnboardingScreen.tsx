import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, Group } from '../types';
import { 
  createGroupInFirestore, 
  joinGroupInFirestore, 
  registerUser, 
  loginUser, 
  getUserGroup,
  resetPassword,
  observeAuthState
} from '../services/firebase';

interface OnboardingProps {
  onComplete: (user: User, group: Group) => void;
}

const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {
  // Phase: 'AUTH' (Login/Signup) or 'GROUP' (Join/Create)
  const [phase, setPhase] = useState<'AUTH' | 'GROUP'>('AUTH');
  
  // Auth State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
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
      if (firebaseUser && !firebaseUser.isAnonymous) {
        // User is logged in
        try {
          setIsLoading(true);
          // Reconstruct User object
          const userObj: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'مستخدم',
            email: firebaseUser.email || '',
            isAdmin: false,
            isGuest: false,
            privacySettings: { showDetails: false, shareLocation: false }
          };
          
          setCurrentUser(userObj);

          // Check if they have a group
          const group = await getUserGroup(firebaseUser.uid);
          if (group) {
            onComplete(userObj, group);
          } else {
            setPhase('GROUP');
            setIsLoading(false);
          }
        } catch (err) {
          console.error(err);
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
      } else if (authMode === 'FORGOT') {
        await resetPassword(email);
        setSuccessMsg("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
        setAuthMode('LOGIN');
      }
    } catch (err: any) {
      console.error(err);
      setError(translateError(err.code || err.message));
    } finally {
      setIsLoading(false);
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
             <p className="text-emerald-100 opacity-90 text-sm">سجل دخولك لإنشاء مجموعة عائلية أو الانضمام لأصدقائك</p>
          </div>
        </div>

        <div className="p-8">
          {phase === 'AUTH' && (
            <>
              {/* Auth Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => { setAuthMode('LOGIN'); setError(''); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'LOGIN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                >
                  تسجيل دخول
                </button>
                <button
                  onClick={() => { setAuthMode('REGISTER'); setError(''); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'REGISTER' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                >
                  حساب جديد
                </button>
              </div>

              {authMode === 'FORGOT' ? (
                 <div className="mb-6 text-center">
                    <h3 className="font-bold text-slate-800 mb-2">نسيت كلمة المرور؟</h3>
                    <p className="text-xs text-slate-500">أدخل بريدك الإلكتروني لنرسل لك رابط الاستعادة.</p>
                 </div>
              ) : null}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
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

                {authMode !== 'FORGOT' && (
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
                )}

                {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center font-bold" style={{direction: 'ltr'}}>{error}</div>}
                {successMsg && <div className="text-emerald-600 text-xs bg-emerald-50 p-3 rounded-lg">{successMsg}</div>}

                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  {authMode === 'LOGIN' ? 'دخول' : authMode === 'REGISTER' ? 'إنشاء الحساب' : 'إرسال الرابط'}
                </button>

                {authMode === 'LOGIN' && (
                  <button 
                    type="button"
                    onClick={() => { setAuthMode('FORGOT'); setError(''); }}
                    className="block w-full text-center text-xs text-slate-400 mt-2 hover:text-emerald-600"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
                
                {authMode === 'FORGOT' && (
                  <button 
                    type="button"
                    onClick={() => { setAuthMode('LOGIN'); setError(''); }}
                    className="block w-full text-center text-xs text-slate-400 mt-4 hover:text-emerald-600"
                  >
                    العودة لتسجيل الدخول
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