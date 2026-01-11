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
  observeAuthState
} from './services/firebase';

function App() {
  // Initialize with a Guest User by default so the app opens immediately
  const [user, setUser] = useState<User | null>({
    id: 'guest_user',
    name: 'زائر',
    isAdmin: false,
    isGuest: true,
    privacySettings: { showDetails: false, shareLocation: false }
  });
  
  // Default dummy group for the guest so UI components don't crash
  const [group, setGroup] = useState<Group | null>({
    id: 'guest_space',
    name: 'مساحتي الخاصة',
    timezone: 'Asia/Muscat'
  });

  const [activeTab, setActiveTab] = useState('today');
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // Real-time Data State
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [locationPoints, setLocationPoints] = useState<LocationPoint[]>([]);
  
  // Local Settings (Not synced globally)
  const [locationSettings, setLocationSettings] = useState<LocationSettings>({
    userId: '',
    mode: 'OFF',
    visibility: 'ALL',
    selectedUserIds: [],
    accuracy: 'APPROX',
    pauseUntil: null
  });

  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // 1. Initial Auth Check
  useEffect(() => {
    const unsubscribe = observeAuthState((firebaseUser) => {
        if (firebaseUser) {
           // If we found a real logged-in user, update state
           // We rely on Onboarding or successful login callback to set full state properly if not handled here.
        }
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Subscriptions (Only if not guest space)
  useEffect(() => {
    if (!group?.id || group.id === 'guest_space') return;

    const unsubMembers = subscribeToMembers(group.id, (fetchedMembers) => setMembers(fetchedMembers));
    const unsubLogs = subscribeToLogs(group.id, (fetchedLogs) => setLogs(fetchedLogs));
    const unsubLocs = subscribeToLocations(group.id, (fetchedPoints) => setLocationPoints(fetchedPoints));

    return () => {
      unsubMembers();
      unsubLogs();
      unsubLocs();
    };
  }, [group?.id]);

  const handleLogin = (newUser: User, newGroup: Group) => {
    setUser(newUser);
    setGroup(newGroup);
    setLocationSettings(prev => ({ ...prev, userId: newUser.id }));
    setIsLoading(false);
    // Stay on group tab after login
    setActiveTab('group'); 
  };

  const handleLogout = async () => {
    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      await logoutUser();
      // Reset to Guest Mode
      setUser({
        id: 'guest_user',
        name: 'زائر',
        isAdmin: false,
        isGuest: true,
        privacySettings: { showDetails: false, shareLocation: false }
      });
      setGroup({
        id: 'guest_space',
        name: 'مساحتي الخاصة',
        timezone: 'Asia/Muscat'
      });
      setActiveTab('today');
    }
  };

  const addLog = async (type: ActivityType, summary: string, details?: string, category?: any) => {
    if (!user || !group) return;

    // Create log object
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

    // If user is in Guest Space, local only. 
    // If user is Guest but in Real Group (joined via code), sync to Firestore.
    if (group.id === 'guest_space') {
      setLogs(prev => [newLog, ...prev]);
    } else {
      await logActivityToFirestore(group.id, newLog);
    }
  };

  const updateLocationSettings = (newSettings: Partial<LocationSettings>) => {
    setLocationSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateMyLocation = async (lat: number, lng: number, accuracyLabel: 'تقريبي' | 'دقيق') => {
    // Only sync location if in a real group
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
    switch (activeTab) {
      case 'today': 
        return <TodayScreen 
          user={user!} 
          group={group!} 
          logs={logs} 
          addLog={addLog}
          members={members}
          locationSettings={locationSettings}
          updateLocationSettings={updateLocationSettings}
          updateMyLocation={updateMyLocation}
          onNavigate={setActiveTab}
        />;
      case 'dhikr': 
        return <DhikrScreen user={user!} addLog={addLog} />;
      case 'read': 
        return <QuranScreen user={user!} addLog={addLog} />;
      case 'group': 
        // Logic: Show Onboarding only if the user is in the default "guest_space".
        // If they joined a group via code (even if they are a 'guest' auth-wise), they should see the group screen.
        if (group?.id === 'guest_space') {
           return <OnboardingScreen onComplete={handleLogin} />;
        }
        return <GroupScreen 
          user={user!} 
          group={group!} 
          members={members} 
          logs={logs} 
          locationPoints={locationPoints}
          googleAccessToken={googleAccessToken}
          setGoogleAccessToken={setGoogleAccessToken}
        />;
      default: 
        return <TodayScreen 
          user={user!} 
          group={group!} 
          logs={logs} 
          addLog={addLog}
          members={members}
          locationSettings={locationSettings}
          updateLocationSettings={updateLocationSettings}
          updateMyLocation={updateMyLocation}
          onNavigate={setActiveTab}
        />;
    }
  };

  if (!user) return null; // Should not happen with default state

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <Header 
        activeTab={activeTab} 
        userInitials={user.name[0]} 
        onInfoClick={() => setShowInfoModal(true)}
      />
      
      <main className="max-w-md mx-auto min-h-[calc(100vh-8rem)]">
        {renderScreen()}
      </main>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* INFO MODAL */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowInfoModal(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Background Pattern */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-emerald-600 opacity-10 rounded-b-[50%]" style={{zIndex: 0}}></div>

            <div className="relative z-10">
               {/* LOGO SECTION */}
               <div className="w-28 h-28 mx-auto mb-6 bg-white rounded-full p-2 shadow-lg flex items-center justify-center border-4 border-emerald-50">
                  <img 
                    src="https://img.freepik.com/premium-vector/quran-logo-vector-islamic-logo-vector-book-logo_969860-262.jpg" 
                    alt="شعار فذكر" 
                    className="w-full h-full object-cover rounded-full"
                  />
               </div>

               <h2 className="text-3xl font-bold font-amiri text-emerald-800 mb-2">فَذَكِّر</h2>
               <p className="text-sm text-slate-500 mb-8">إصدار 1.0.0</p>

               {/* DEDICATION TEXT */}
               <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                  <p className="font-amiri font-bold text-slate-700 text-lg leading-loose mb-2">
                    اللهم اغفر لوالديَّ وارحمهما كما ربَّياني صغيرًا.
                  </p>
                  <p className="text-xs text-slate-500">
                    صدقةٌ جاريةٌ لوالديَّ، عن أمواتِنا وأمواتِ المسلمين.
                  </p>
               </div>

               {/* COPYRIGHT */}
               <div className="text-xs text-slate-400 space-y-1">
                 <p>© حقوق النشر: أحمد عبد الفتاح</p>
                 <p className="font-mono">abdelfttah71@gmail.com</p>
               </div>
               
               <div className="flex gap-2 justify-center mt-6">
                 {/* Show logout if not in guest space OR if user is not anonymous */}
                 {group?.id !== 'guest_space' && (
                   <button 
                     onClick={handleLogout}
                     className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs border border-red-100"
                   >
                     مغادرة المجموعة
                   </button>
                 )}
                 <button 
                   onClick={() => setShowInfoModal(false)}
                   className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs shadow-lg shadow-slate-200"
                 >
                   إغلاق
                 </button>
               </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;