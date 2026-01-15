
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import TodayScreen from './screens/TodayScreen';
import DhikrScreen from './screens/DhikrScreen';
import QuranScreen from './screens/QuranScreen';
import GroupScreen from './screens/GroupScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { User, Group, ActivityLog, ActivityType, LocationSettings, LocationPoint } from './types';
import { 
  subscribeToLogs, 
  subscribeToMembers, 
  subscribeToLocations, 
  logActivityToFirestore,
  updateLocationInFirestore,
  logoutUser,
  observeAuthState,
  leaveGroupInFirestore
} from './services/firebase';

// FIX: Defined outside component to prevent re-mounting on every state change
const ScrollWrapper = ({ children }: { children?: React.ReactNode }) => (
  <div className="h-full overflow-y-auto no-scrollbar pb-20">
    {children}
  </div>
);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);

  const [activeTab, setActiveTab] = useState('today');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showStartupDua, setShowStartupDua] = useState(true); // New state for startup Dua
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null); // Toast State
  
  // Invite Link State
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [pendingGroupData, setPendingGroupData] = useState<Group | null>(null);

  // Real-time Data State
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [locationPoints, setLocationPoints] = useState<LocationPoint[]>([]);
  
  // Local Settings
  const [locationSettings, setLocationSettings] = useState<LocationSettings>({
    userId: '',
    mode: 'OFF',
    visibility: 'ALL',
    selectedUserIds: [],
    accuracy: 'APPROX',
    pauseUntil: null
  });

  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // 0. Check URL for Invite Code (Direct Link Feature)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('inviteCode');
    const dataStr = params.get('d'); // Get encoded group data

    if (code) {
      setPendingInviteCode(code);
      
      // Parse encoded group data if available (Radical Fix for Mock Mode)
      if (dataStr) {
        try {
          const decoded = JSON.parse(atob(dataStr));
          if (decoded && decoded.id && decoded.name) {
             setPendingGroupData(decoded);
          }
        } catch (e) {
          console.error("Failed to parse group data from URL", e);
        }
      }

      // Optional: Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 1. Initial Auth & Persistence Check
  useEffect(() => {
    const unsubscribe = observeAuthState((authState) => {
      if (authState) {
        const mappedUser: User = {
            id: authState.uid || authState.id,
            name: authState.displayName || authState.name || 'مستخدم',
            email: authState.email || '',
            isAdmin: authState.isAdmin || false,
            isGuest: authState.isAnonymous || authState.isGuest || false,
            privacySettings: authState.privacySettings || { showDetails: false, shareLocation: false },
            avatar: authState.photoURL || authState.avatar
        };

        setUser(mappedUser);
        setLocationSettings(prev => ({ ...prev, userId: mappedUser.id }));
        
        // Try to recover group from local storage membership mapping
        const storedMembers = JSON.parse(localStorage.getItem('f_members') || '[]');
        const membership = storedMembers.find((m: any) => m.userId === mappedUser.id);
        if (membership) {
           const storedGroups = JSON.parse(localStorage.getItem('f_groups') || '[]');
           const foundGroup = storedGroups.find((g: any) => g.id === membership.groupId);
           // Validate foundGroup structure roughly
           if (foundGroup && foundGroup.id) {
             setGroup(foundGroup);
           } else {
             setGroup({ id: 'guest_space', name: 'مساحتي الخاصة', timezone: 'Asia/Muscat' });
           }
        } else {
           setGroup({ id: 'guest_space', name: 'مساحتي الخاصة', timezone: 'Asia/Muscat' });
        }

      } else {
        const storedGuest = localStorage.getItem('fathakkir_guest_fallback');
        if (storedGuest) {
           const guestUser = JSON.parse(storedGuest);
           setUser(guestUser);
           setGroup({ id: 'guest_space', name: 'مساحتي الخاصة', timezone: 'Asia/Muscat' });
        } else {
           const newGuestId = `guest_${Date.now()}`;
           const newGuest: User = {
             id: newGuestId,
             name: 'زائر',
             isAdmin: false,
             isGuest: true,
             privacySettings: { showDetails: false, shareLocation: false }
           };
           localStorage.setItem('fathakkir_guest_fallback', JSON.stringify(newGuest));
           setUser(newGuest);
           setGroup({ id: 'guest_space', name: 'مساحتي الخاصة', timezone: 'Asia/Muscat' });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Subscriptions
  useEffect(() => {
    if (!group?.id) return;
    
    const unsubMembers = subscribeToMembers(group.id, (fetchedMembers) => setMembers(fetchedMembers || []));
    const unsubLogs = subscribeToLogs(group.id, (fetchedLogs) => {
        if (group.id === 'guest_space' && user) {
            setLogs((fetchedLogs || []).filter(l => l.userId === user.id));
        } else {
            setLogs(fetchedLogs || []);
        }
    });
    const unsubLocs = subscribeToLocations(group.id, (fetchedPoints) => setLocationPoints(fetchedPoints || []));

    return () => {
      unsubMembers();
      unsubLogs();
      unsubLocs();
    };
  }, [group?.id, user?.id]);

  const handleLogin = (newUser: User, newGroup: Group) => {
    setUser(newUser);
    setGroup(newGroup);
    setLocationSettings(prev => ({ ...prev, userId: newUser.id }));
    if (!newUser.isGuest) {
        localStorage.removeItem('fathakkir_guest_fallback');
    }
    setActiveTab('group'); 
  };

  const handleLogout = async () => {
    // UPDATED LOGOUT CONFIRMATION MESSAGE
    if (window.confirm("اللهم اغفر لوالدي وارحمهما كما ربياني صغيرا \n\nهل أنت متأكد من الخروج؟")) {
      await logoutUser();
      localStorage.removeItem('fathakkir_guest_fallback');
      window.location.reload();
    }
  };

  const handleLeaveGroup = async () => {
    if (user && group && group.id !== 'guest_space') {
       // Call the Service to remove from DB/Firestore
       await leaveGroupInFirestore(user.id, group.id);
       
       // Force update local state immediately
       const members = JSON.parse(localStorage.getItem('f_members') || '[]');
       const newMembers = members.filter((m: any) => m.userId !== user.id);
       localStorage.setItem('f_members', JSON.stringify(newMembers));
       
       // Reset Group State
       setGroup({ id: 'guest_space', name: 'مساحتي الخاصة', timezone: 'Asia/Muscat' });
       setActiveTab('group');
    }
  };

  const handleResetData = () => {
    if(window.confirm("تحذير: سيتم مسح جميع بيانات التطبيق المحلية وإعادته لحالته الأصلية. هل أنت متأكد؟")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const addLog = async (type: ActivityType, summary: string, details?: string, category?: any) => {
    // FIX: Determine Group ID securely: Use state, or fallback to guest_space if UI is in fallback mode
    const targetGroupId = group?.id || 'guest_space';

    if (!user) {
        console.error("User missing during addLog");
        return;
    }

    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId: user.id,
      userName: user.name,
      type,
      summary,
      details,
      category,
      timestamp: Date.now(),
    };
    
    try {
      await logActivityToFirestore(targetGroupId, newLog);
      showToast("✅ تم تسجيل النشاط");
    } catch (e) {
      console.error("Failed to add log:", e);
      alert("تعذر حفظ النشاط، يرجى المحاولة مرة أخرى.");
    }
  };

  const updateLocationSettings = (newSettings: Partial<LocationSettings>) => {
    setLocationSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateMyLocation = async (lat: number, lng: number, accuracyLabel: 'تقريبي' | 'دقيق') => {
    if (!user || !group || group.id === 'guest_space') return; 

    const point: LocationPoint = {
      userId: user.id,
      lat,
      lng,
      accuracyLabel,
      timestamp: Date.now()
    };
    
    await updateLocationInFirestore(group.id, point);
  };

  const renderScreen = () => {
    // 1. Safety check for loading state
    if (!user || (!group && activeTab === 'group')) {
       return (
         <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
         </div>
       );
    }

    // 2. Fallback group if missing (prevent crash in other tabs)
    const safeGroup = group || { id: 'guest_space', name: 'تحميل...', timezone: 'Asia/Muscat' };

    switch (activeTab) {
      case 'today': 
        return (
          <ScrollWrapper>
            <TodayScreen 
              user={user} 
              group={safeGroup}
              logs={logs} 
              addLog={addLog}
              members={members}
              locationSettings={locationSettings}
              updateLocationSettings={updateLocationSettings}
              updateMyLocation={updateMyLocation}
              onNavigate={setActiveTab}
              isDarkMode={isDarkMode}
            />
          </ScrollWrapper>
        );
      case 'dhikr': 
        return (
          <ScrollWrapper>
            <DhikrScreen user={user} addLog={addLog} isDarkMode={isDarkMode} />
          </ScrollWrapper>
        );
      case 'read': 
        return <QuranScreen user={user} addLog={addLog} isDarkMode={isDarkMode} />;
      case 'group': 
        if (safeGroup.id === 'guest_space') {
           return (
            <ScrollWrapper>
               <OnboardingScreen 
                 onComplete={handleLogin} 
                 initialInviteCode={pendingInviteCode}
                 initialGroupData={pendingGroupData}
               />
            </ScrollWrapper>
           );
        }
        return (
          <ScrollWrapper>
            <GroupScreen 
              user={user} 
              group={safeGroup} 
              members={members} 
              logs={logs} 
              locationPoints={locationPoints}
              googleAccessToken={googleAccessToken}
              setGoogleAccessToken={setGoogleAccessToken}
              onLeaveGroup={handleLeaveGroup}
              isDarkMode={isDarkMode}
            />
          </ScrollWrapper>
        );
      default: 
        return (
          <ScrollWrapper>
            <TodayScreen 
              user={user} 
              group={safeGroup} 
              logs={logs} 
              addLog={addLog}
              members={members}
              locationSettings={locationSettings}
              updateLocationSettings={updateLocationSettings}
              updateMyLocation={updateMyLocation}
              onNavigate={setActiveTab}
              isDarkMode={isDarkMode}
            />
          </ScrollWrapper>
        );
    }
  };

  if (!user) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-sky-50">
        <div className="flex flex-col items-center animate-pulse">
           <div className="w-16 h-16 bg-sky-200 rounded-full mb-4"></div>
           <p className="text-sky-700 font-bold">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Safety check for name
  const safeName = user.name || 'مستخدم';
  const initial = safeName.length > 0 ? safeName[0] : 'م';

  return (
    // FIXED VIEWPORT HEIGHT (100dvh)
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-300 font-sans ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-gradient-to-b from-sky-100 via-sky-50 to-white text-slate-900'}`}>
      
      {/* STARTUP DUA MODAL */}
      {showStartupDua && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in" style={{zIndex: 9999}}>
          <div className={`w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}>
             <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600"></div>
             
             <div className="text-4xl mb-6 opacity-80">🤲</div>
             
             <p className="text-xl md:text-2xl font-bold font-amiri leading-loose mb-8 text-emerald-800 dark:text-emerald-400">
               اللَّهُمَّ اغْفِرْ لِوَالِدَيَّ وَارْحَمْهُمَا، كَمَا رَبَّيَانِي صَغِيرًا، وَاغْفِرْ لِأَمْوَاتِنَا وَأَمْوَاتِ الْمُسْلِمِينَ
             </p>

             <button 
               onClick={() => setShowStartupDua(false)}
               className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200/50 transition-all active:scale-95"
             >
               آمين
             </button>
          </div>
        </div>
      )}

      <div className="shrink-0 z-50">
        <Header 
          userInitials={initial} 
          onInfoClick={() => setShowInfoModal(true)}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
      </div>
      
      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto relative overflow-hidden">
        {renderScreen()}
      </main>

      {/* Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg z-[100] animate-fade-in text-sm font-bold flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* INFO MODAL */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowInfoModal(false)}>
          <div className={`w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`} onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-32 bg-sky-600 opacity-10 rounded-b-[50%]" style={{zIndex: 0}}></div>
            <div className="relative z-10">
               <div className={`w-28 h-28 mx-auto mb-6 rounded-full p-2 shadow-lg flex items-center justify-center border-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-sky-50 text-sky-600'}`}>
                  {/* APP LOGO SVG */}
                  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%2310b981' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zM128 384c0-35.3 28.7-64 64-64h64c35.3 0 64 28.7 64 64H128zm128-96h-64c-17.7 0-32-14.3-32-32s14.3-32 32-32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32zM362.7 253.9c-7.5-6.1-13.9-13.3-18.8-21.3l-20.8-33.4c-7.6-12.2-11.6-26.3-11.6-40.7 0-44.1 35.9-80 80-80 9.7 0 19 1.7 27.8 4.9-18.5-38.6-58.1-65.4-104.3-65.4-63.5 0-115 51.5-115 115 0 6.1.5 12.1 1.4 17.9l-19.1-30.6c-7.6-12.2-11.6-26.3-11.6-40.7 0-25 11.5-47.3 29.6-62.6-67.6 15.1-118.9 75.3-118.9 147.3 0 83.9 68.1 152 152 152h.9c-3.1-8.8-4.9-18.1-4.9-27.8 0-44.1 35.9-80 80-80 12.8 0 25.1 3 36.3 8.3-2.1-7.2-3.3-14.8-3.3-22.7 0-44.1 35.9-80 80-80z'/%3E%3C/svg%3E" alt="Logo" className="w-full h-full object-cover rounded-full" />
               </div>
               <h2 className="text-3xl font-bold font-amiri mb-2">فَذَكِّر</h2>
               <p className="text-sm opacity-50 mb-6">إصدار 1.0.7</p>
               
               {/* UPDATED DUA & COPYRIGHT */}
               <div className={`rounded-xl p-4 mb-4 border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="font-amiri font-bold text-lg leading-loose mb-2 text-emerald-600">
                    اللَّهُمَّ اغْفِرْ لِوَالِدَيَّ وَارْحَمْهُمَا، كَمَا رَبَّيَانِي صَغِيرًا، وَاغْفِرْ لِأَمْوَاتِنَا وَأَمْوَاتِ الْمُسْلِمِينَ
                  </p>
               </div>
               
               <div className="text-xs opacity-70 mb-6 font-mono leading-relaxed">
                 <p className="font-bold">حقوق النشر - احمد عبد الفتاح</p>
                 <p>abdelfttah71@gmail.com</p>
               </div>

               <div className="flex flex-col gap-2 justify-center mt-4">
                 {/* LOGOUT BUTTON - ENABLED FOR ALL */}
                 <button 
                   onClick={handleLogout}
                   className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs border border-red-100 hover:bg-red-100"
                 >
                   تسجيل خروج
                 </button>

                 <button 
                    onClick={handleResetData}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700"
                 >
                    حذف البيانات وإعادة ضبط (إصلاح المشاكل)
                 </button>
                 <button onClick={() => setShowInfoModal(false)} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs shadow-lg">إغلاق</button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
