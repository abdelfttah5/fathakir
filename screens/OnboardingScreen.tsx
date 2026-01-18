
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, Group } from '../types';
import { 
  createGroupInFirestore, 
  joinGroupInFirestore,
  joinGroupViaSeeding,
  loginGuestUser,
  getUserGroup,
  observeAuthState
} from '../services/firebase';

interface OnboardingProps {
  onComplete: (user: User, group: Group) => void;
  initialInviteCode?: string | null;
  initialGroupData?: any | null;
}

const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete, initialInviteCode, initialGroupData }) => {
  // Simplified State: No Email/Password phases anymore
  // Step 1: Input Name. Step 2: Choose (Create or Join).
  
  const [step, setStep] = useState<'NAME' | 'ACTION'>('NAME');
  const [name, setName] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Action State
  const [actionType, setActionType] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle URL Deep Link
  useEffect(() => {
    if (initialInviteCode) {
      setInviteCode(initialInviteCode);
    }
  }, [initialInviteCode]);

  // Check for existing session
  useEffect(() => {
    const unsubscribe = observeAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        setIsLoading(true);
        try {
          const userObj: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'مستخدم',
            isAdmin: false,
            isGuest: true, // Treated as guest/anonymous for simplicity
            privacySettings: { showDetails: false, shareLocation: false }
          };
          
          setCurrentUser(userObj);

          // Deep Link Logic
          if (initialGroupData) {
             const joinedGroup = await joinGroupViaSeeding(initialGroupData, userObj);
             onComplete(userObj, joinedGroup);
             return;
          }

          // Check if already in a group
          const group = await getUserGroup(firebaseUser.uid);
          if (group) {
            onComplete(userObj, group);
          } else {
            // Logged in but no group -> Go to Action Step
            setName(userObj.name);
            setStep('ACTION');
            setIsLoading(false);
          }
        } catch (err) {
          console.error(err);
          setStep('NAME');
          setIsLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [initialGroupData]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setIsLoading(true);

    try {
      // Authenticate anonymously with Name
      const user = await loginGuestUser(name);
      setCurrentUser(user);
      
      // If we have an invite code already (from URL), go straight to join logic
      if (initialGroupData) {
         const joinedGroup = await joinGroupViaSeeding(initialGroupData, user);
         onComplete(user, joinedGroup);
      } else {
         setStep('ACTION');
      }
    } catch (err: any) {
      setError("حدث خطأ أثناء تسجيل الدخول. تأكد من الاتصال بالإنترنت.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setError('');
    setIsLoading(true);

    try {
      let targetGroup: Group;

      if (actionType === 'CREATE') {
        if (!groupName.trim()) throw new Error("الرجاء كتابة اسم للمجموعة");
        
        const groupId = `group_${Date.now()}`;
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const newGroup: Group = {
          id: groupId,
          name: groupName,
          timezone: 'Asia/Muscat',
          inviteCode: newCode,
          adminId: currentUser.id
        };

        await createGroupInFirestore(newGroup, currentUser);
        targetGroup = newGroup;
        currentUser.isAdmin = true; 

      } else {
        // JOIN LOGIC
        if (!inviteCode.trim()) throw new Error("الرجاء إدخال رمز المجموعة");
        const codeClean = inviteCode.trim().toUpperCase();
        
        // Real Firestore Join
        const foundGroup = await joinGroupInFirestore(codeClean, currentUser);
        if (!foundGroup) throw new Error("لم يتم العثور على مجموعة بهذا الرمز، تأكد منه.");
        targetGroup = foundGroup;
      }

      setSuccessMsg(actionType === 'CREATE' ? "تم إنشاء المجموعة بنجاح!" : "تم الانضمام بنجاح!");
      
      setTimeout(() => {
         onComplete(currentUser, targetGroup);
      }, 1500);

    } catch (err: any) {
      console.error("Action Error:", err);
      setError(err.message || "حدث خطأ غير متوقع. حاول مرة أخرى.");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-slate-500">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-bold">جاري الاتصال...</p>
          </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 text-slate-800 dir-rtl relative h-full">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden mb-8">
        
        {/* Header */}
        <div className="bg-emerald-600 p-8 text-center text-white relative">
          <h1 className="text-3xl font-bold font-amiri mb-2">فَذَكِّر</h1>
          <p className="text-emerald-100 opacity-90 text-sm">
            {step === 'NAME' ? 'ابدأ رحلتك الإيمانية مع عائلتك' : `أهلاً بك، ${name}`}
          </p>
        </div>

        <div className="p-8">
          
          {/* STEP 1: ENTER NAME */}
          {step === 'NAME' && (
            <form onSubmit={handleNameSubmit} className="space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">ما هو اسمك؟</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg text-center" 
                  placeholder="اكتب اسمك هنا" 
                  required 
                  autoFocus
                />
              </div>
              
              {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center font-bold">{error}</div>}

              <button type="submit" disabled={!name.trim()} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 text-lg">
                متابعة
              </button>
            </form>
          )}

          {/* STEP 2: CREATE OR JOIN */}
          {step === 'ACTION' && (
            <div className="animate-slide-up">
              {/* Toggle Buttons */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => { setActionType('CREATE'); setError(''); }}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${actionType === 'CREATE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}
                >
                  إنشاء مجموعة
                </button>
                <button
                  onClick={() => { setActionType('JOIN'); setError(''); }}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${actionType === 'JOIN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}
                >
                  انضمام لمجموعة
                </button>
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                {actionType === 'CREATE' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">اسم المجموعة الجديدة</label>
                    <input 
                      type="text" 
                      value={groupName} 
                      onChange={(e) => setGroupName(e.target.value)} 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                      placeholder="مثال: عائلتي، رفاق الجنة..." 
                      autoFocus
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">أدخل رمز الدعوة</label>
                    <input 
                      type="text" 
                      value={inviteCode} 
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())} 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-center text-2xl font-mono uppercase tracking-widest placeholder:text-base placeholder:tracking-normal" 
                      placeholder="مثال: X7Y-2AB" 
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-400 mt-2 text-center">اطلب الرمز من منشئ المجموعة</p>
                  </div>
                )}

                {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center font-bold">{error}</div>}
                {successMsg && <div className="text-emerald-600 text-xs bg-emerald-50 p-3 rounded-lg text-center font-bold">{successMsg}</div>}

                <button type="submit" disabled={!!successMsg} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all mt-4 disabled:opacity-50 text-lg">
                  {actionType === 'CREATE' ? 'إنشاء وبدء ✅' : 'انضمام الآن 🚀'}
                </button>
                
                <button type="button" onClick={() => setStep('NAME')} className="w-full py-2 text-xs text-slate-400 font-bold mt-2">
                  تغيير الاسم
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
