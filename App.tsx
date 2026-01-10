import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import TodayScreen from './screens/TodayScreen';
import DhikrScreen from './screens/DhikrScreen';
import QuranScreen from './screens/QuranScreen';
import GroupScreen from './screens/GroupScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { User, Group, ActivityLog, ActivityType, LocationSettings, LocationPoint } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [activeTab, setActiveTab] = useState('today');
  const [isLoading, setIsLoading] = useState(true);
  
  // Lifted State for Data
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  
  // Lifted State for Location (Simulation for MVP)
  const [locationSettings, setLocationSettings] = useState<LocationSettings>({
    userId: '',
    mode: 'OFF',
    visibility: 'ALL',
    selectedUserIds: [],
    accuracy: 'APPROX',
    pauseUntil: null
  });
  const [locationPoints, setLocationPoints] = useState<LocationPoint[]>([]);

  // Simulate Google Access Token
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Check local storage for persisted session
    const storedUser = localStorage.getItem('fathakkir_user');
    const storedGroup = localStorage.getItem('fathakkir_group');
    
    if (storedUser && storedGroup) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setGroup(JSON.parse(storedGroup));
      setMembers([parsedUser]); 
      setLocationSettings(prev => ({ ...prev, userId: parsedUser.id }));
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (newUser: User, newGroup: Group) => {
    setUser(newUser);
    setGroup(newGroup);
    setMembers([newUser]);
    setLocationSettings(prev => ({ ...prev, userId: newUser.id }));
    localStorage.setItem('fathakkir_user', JSON.stringify(newUser));
    localStorage.setItem('fathakkir_group', JSON.stringify(newGroup));
  };

  const addLog = (type: ActivityType, summary: string, details?: string, category?: any) => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      userId: user!.id,
      userName: user!.name,
      type,
      summary,
      details,
      category,
      timestamp: Date.now(),
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // --- Location Handlers (Mocking Firestore) ---
  const updateLocationSettings = (newSettings: Partial<LocationSettings>) => {
    setLocationSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateMyLocation = (lat: number, lng: number, accuracyLabel: 'تقريبي' | 'دقيق') => {
    const point: LocationPoint = {
      userId: user!.id,
      lat,
      lng,
      accuracyLabel,
      timestamp: Date.now()
    };
    
    setLocationPoints(prev => {
      // Upsert: Remove old point for this user, add new
      const filtered = prev.filter(p => p.userId !== user!.id);
      return [...filtered, point];
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-emerald-50 text-emerald-600">جاري التحميل...</div>;
  }

  if (!user) {
    return <OnboardingScreen onComplete={handleLogin} />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'today': 
        return <TodayScreen 
          user={user} 
          group={group!} 
          logs={logs} 
          addLog={addLog}
          members={members}
          locationSettings={locationSettings}
          updateLocationSettings={updateLocationSettings}
          updateMyLocation={updateMyLocation}
        />;
      case 'dhikr': 
        return <DhikrScreen user={user} addLog={addLog} />;
      case 'read': 
        return <QuranScreen user={user} addLog={addLog} />;
      case 'group': 
        return <GroupScreen 
          user={user} 
          group={group!} 
          members={members} 
          logs={logs} 
          locationPoints={locationPoints}
          googleAccessToken={googleAccessToken}
          setGoogleAccessToken={setGoogleAccessToken}
        />;
      default: 
        return <TodayScreen 
          user={user} 
          group={group!} 
          logs={logs} 
          addLog={addLog}
          members={members}
          locationSettings={locationSettings}
          updateLocationSettings={updateLocationSettings}
          updateMyLocation={updateMyLocation}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <Header title={activeTab === 'today' ? undefined : getTitle(activeTab)} userInitials={user.name[0]} />
      <main className="max-w-md mx-auto min-h-[calc(100vh-8rem)]">
        {renderScreen()}
      </main>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function getTitle(tab: string) {
  switch (tab) {
    case 'dhikr': return 'الأذكار';
    case 'read': return 'القرآن الكريم';
    case 'group': return 'مجموعتي';
    default: return '';
  }
}

export default App;
