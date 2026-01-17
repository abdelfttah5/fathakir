
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, Group } from '../types';
import { 
  createGroupInFirestore, 
  joinGroupInFirestore,
  joinGroupViaSeeding, // Using the new robust function
  registerUser, 
  loginUser, 
  loginGuestUser,
  getUserGroup,
  resetPassword,
  observeAuthState,
  logoutUser
} from '../services/firebase';

interface OnboardingProps {
  onComplete: (user: User, group: Group) => void;
  initialInviteCode?: string | null;
  initialGroupData?: any | null; // Changed to any to support extended props
}

const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete, initialInviteCode, initialGroupData }) => {
  // Phase: 'AUTH' (Login/Signup/QuickJoin) or 'GROUP' (Create/Join manually)
  const [phase, setPhase] = useState<'AUTH' | 'GROUP'>('AUTH');
  
  // Auth State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'JOIN_CODE' | 'QUICK_CREATE'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Quick Join/Create State
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

  // EFFECT: Handle "Direct Link" Invitation
  // If we have initialGroupData, we change the UI completely to "Accept Invitation" mode.
  const isInviteFlow = !!initialGroupData;

  useEffect(() => {
    if (initialInviteCode) {
      setQuickCode(initialInviteCode);
      setInviteToken(initialInviteCode);
    }
  }, [initialInviteCode]);

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
            isGuest: firebaseUser.isAnonymous,
            privacySettings: { showDetails: false, shareLocation: false }
          };
          
          setCurrentUser(userObj);

          // If coming via Invite Link, we must force join them to THAT group
          if (initialGroupData) {
             const joinedGroup = await joinGroupViaSeeding(initialGroupData, userObj);
             onComplete(userObj, joinedGroup);
             return;
          }

          // Otherwise check their existing group
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
  }, [initialGroupData]); // Re-run if invitation data changes

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
        setIsLoading(false);

      } else if (authMode === 'LOGIN') {
        const user = await loginUser(email, password);
        setCurrentUser({ ...user, isGuest: false });
        const group = await getUserGroup(user.id);
        if (group) {
          onComplete({ ...user, isGuest: false }, group);
        } else {
          setPhase('GROUP');
          setIsLoading(false);
        }

      } else if (authMode === 'JOIN_CODE') {
        // QUICK JOIN / INVITE FLOW
        if (!quickName.trim()) throw new Error("الرجاء إدخال الاسم");
        
        // 1. Create Guest User
        const user = await loginGuestUser(quickName);
        
        // 2. Determine Group Target
        let group: Group | null = null;

        if (initialGroupData) {
           // FORCE JOIN via Seeding (Reliable)
           group = await joinGroupViaSeeding(initialGroupData, user);
           // CUSTOM SUCCESS MESSAGE FOR INVITE
           setSuccessMsg(`🎉 تم الانضمام بنجاح بدعوة من ${initialGroupData.adminName || 'المشرف'}!`);
        } else {
           // Search by Code (Fallback)
           if (!quickCode.trim()) throw new Error("الرجاء إدخال رمز الدعوة");
           const codeClean = quickCode.trim().toUpperCase();
           group = await joinGroupInFirestore(codeClean, user);
           setSuccessMsg("تم الانضمام بنجاح! جاري تحويلك...");
        }

        if (group) {
          setTimeout(() => {
             onComplete(user, group!);
          }, 2000);
        } else {
           throw new Error("لم يتم العثور على المجموعة");
        }

      } else if (authMode === 'QUICK_CREATE') {
        if (!quickName.trim()) throw new Error("الرجاء إدخال الاسم");
        const user = await loginGuestUser(quickName);
        setCurrentUser(user);
        setPhase('GROUP');
        setGroupMode('CREATE');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(translateError(err.code || err.message || err.toString()));
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
        // JOIN via Manual Code
        if (!inviteToken.trim()) throw new Error("أدخل رمز الدعوة");
        const codeClean = inviteToken.trim().toUpperCase();
        const foundGroup = await joinGroupInFirestore(codeClean, currentUser);
        if (!foundGroup) throw new Error("المجموعة غير موجودة");
        targetGroup = foundGroup;
      }

      setSuccessMsg(groupMode === 'CREATE' ? "تم إنشاء المجموعة بنجاح!" : "تم الانضمام بنجاح!");
      setTimeout(() => {
         onComplete(currentUser, targetGroup);
      }, 1500);

    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء إعداد المجموعة");
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

  // --- RENDER FOR DIRECT INVITE FLOW ---
  if (isInviteFlow && initialGroupData) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-800 dir-rtl relative h-full">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden mb-8 border-2 border-emerald-500">
           <div className="bg-emerald-600 p-8 text-center text-white">
              <div className="text-4xl mb-2">💌</div>
              <h1 className="text-xl font-bold">دعوة خاصة</h1>
              <p className="text-emerald-100 opacity-90 text-sm mt-2">
                دعاك <strong>{initialGroupData.adminName || 'صديق'}</strong> للانضمام إلى:
              </p>
              <div className="bg-white/10 p-3 rounded-xl mt-3 backdrop-blur-sm border border-white/20">
                 <h2 className="text-2xl font-bold font-amiri">{initialGroupData.name}</h2>
              </div>
           </div>
           
           <div className="p-8">
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                 {/* Set mode to JOIN_CODE internally but hide selector */}
                 <div onClick={() => setAuthMode('JOIN_CODE')} /> 
                 
                 <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">اسمك (سيظهر للأعضاء)</label>
                    <input
                      type="text"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-center font-bold"
                      placeholder="اكتب اسمك هنا"
                      required
                      autoFocus
                    />
                 </div>

                 {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center font-bold">{error}</div>}
                 
                 {successMsg ? (
                    <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 p-4 rounded-xl text-center font-bold animate-fade-in">
                       {successMsg}
                    </div>
                 ) : (
                    <button 
                      type="submit" 
                      onClick={() => setAuthMode('JOIN_CODE')}
                      disabled={!quickName.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 text-lg"
                    >
                      قبول وانضمام ✅
                    </button>
                 )}
              </form>
           </div>
        </div>
      </div>
    );
  }

  // --- STANDARD RENDER ---
  return (
    <div className="flex flex-col items-center justify-center p-6 text-slate-800 dir-rtl relative h-full">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-8">
        
        {/* Header Section */}
        <div className="bg-emerald-600 p-8 text-center text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
             <h1 className="text-2xl font-bold font-amiri mb-2">مجموعتي</h1>
             <p className="text-emerald-100 opacity-90 text-sm">
               {phase === 'AUTH' ? 'سجل دخولك أو أنشئ مجموعة جديدة للتواصل مع عائلتك' : 'الخطوة الأخيرة: إعداد المجموعة'}
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
                
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">الاسم</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="اسمك الظاهر" required />
                  </div>
                )}

                {(authMode === 'REGISTER' || authMode === 'LOGIN') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">البريد الإلكتروني</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left placeholder:text-right" style={{ direction: 'ltr' }} placeholder="name@example.com" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left" placeholder="••••••••" required minLength={6} />
                    </div>
                  </>
                )}

                {/* JOIN CODE FORM */}
                {authMode === 'JOIN_CODE' && (
                  <>
                    <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-800 mb-4 border border-amber-100 leading-relaxed">
                      <strong>انضمام سريع</strong><br/>
                      أدخل الرمز الذي شاركه معك مسؤول المجموعة.
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">اسمك</label>
                      <input type="text" value={quickName} onChange={(e) => setQuickName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="اسمك الظاهر للعائلة" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">رمز الدعوة</label>
                      <input type="text" value={quickCode} onChange={(e) => setQuickCode(e.target.value.toUpperCase())} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center text-lg font-mono uppercase" placeholder="XYZ-123" required />
                    </div>
                  </>
                )}
                
                {/* QUICK CREATE */}
                {authMode === 'QUICK_CREATE' && (
                   <>
                    <div className="bg-emerald-50 p-4 rounded-xl text-xs text-emerald-800 mb-4 border border-emerald-100 leading-relaxed">
                      <strong>إنشاء مجموعة فورية</strong><br/>
                      ابدأ مجموعتك الخاصة فوراً كزائر.
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">اسمك</label>
                      <input type="text" value={quickName} onChange={(e) => setQuickName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="الاسم الذي سيظهر للأعضاء" required />
                    </div>
                   </>
                )}

                {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center font-bold" style={{direction: 'ltr'}}>{error}</div>}
                {successMsg && <div className="text-emerald-600 text-xs bg-emerald-50 p-3 rounded-lg text-center font-bold">{successMsg}</div>}

                <button type="submit" disabled={!!successMsg} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50">
                  {authMode === 'LOGIN' ? 'دخول' : authMode === 'REGISTER' ? 'إنشاء الحساب' : authMode === 'QUICK_CREATE' ? 'متابعة لإنشاء المجموعة' : 'انضمام للمجموعة'}
                </button>

                {authMode !== 'QUICK_CREATE' && (
                  <button type="button" onClick={() => { setAuthMode('QUICK_CREATE'); setError(''); }} className="w-full py-3 rounded-xl font-bold border-2 border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors mt-2">
                    🚀 إنشاء مجموعة فورية (بدون تسجيل)
                  </button>
                )}
                
                {authMode === 'QUICK_CREATE' && (
                   <button type="button" onClick={() => { setAuthMode('LOGIN'); setError(''); }} className="w-full py-2 text-xs font-bold text-slate-400 mt-2">
                    عودة لتسجيل الدخول
                  </button>
                )}
              </form>
            </>
          )}

          {phase === 'GROUP' && (
            <div className="animate-fade-in">
              <h2 className="text-center font-bold text-xl mb-6">أهلاً بك، {currentUser?.name}</h2>
              <p className="text-center text-xs text-slate-500 mb-6">لقد تم تسجيل دخولك. الآن، قم بإنشاء مجموعتك أو الانضمام لأخرى.</p>
              
              <div className="flex gap-3 mb-6">
                <button onClick={() => setGroupMode('CREATE')} className={`flex-1 py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all ${groupMode === 'CREATE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}>إنشاء مجموعة</button>
                <button onClick={() => setGroupMode('JOIN')} className={`flex-1 py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all ${groupMode === 'JOIN' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}>انضمام لمجموعة</button>
              </div>

              <form onSubmit={handleGroupSubmit} className="space-y-4">
                {groupMode === 'CREATE' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">اسم المجموعة</label>
                    <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="مثال: أسرتي، أصحابي..." />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">رمز الدعوة</label>
                    <input type="text" value={inviteToken} onChange={(e) => setInviteToken(e.target.value.toUpperCase())} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center text-lg font-mono uppercase" placeholder="XYZ-123" />
                  </div>
                )}

                {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center font-bold">{error}</div>}
                {successMsg && <div className="text-emerald-600 text-xs bg-emerald-50 p-3 rounded-lg text-center font-bold">{successMsg}</div>}

                <button type="submit" disabled={!!successMsg} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all mt-4 disabled:opacity-50">
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
