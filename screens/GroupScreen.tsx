import * as React from 'react';
import { useState } from 'react';
import { User, Group, ActivityLog, LocationPoint } from '../types';
import { createGoogleMeetEvent } from '../services/api';

interface GroupScreenProps {
  user: User;
  group: Group;
  members: User[];
  logs: ActivityLog[];
  locationPoints: LocationPoint[];
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string) => void;
}

const GroupScreen: React.FC<GroupScreenProps> = ({ 
  user, group, members, logs, locationPoints, googleAccessToken, setGoogleAccessToken 
}) => {
  const [subTab, setSubTab] = useState<'activity' | 'members' | 'locations' | 'meet'>('activity');
  const [inviteCode, setInviteCode] = useState<string | null>(group.inviteCode || null);
  const [isScheduling, setIsScheduling] = useState(false);

  // --- LOGIC ---
  const handleGenerateInvite = () => {
    if (!user.isAdmin) return;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setInviteCode(newCode);
    alert(`تم إنشاء رمز الدعوة: ${newCode} (صالح لمدة 72 ساعة)`);
  };

  const handleGoogleSignIn = () => {
    const mockToken = prompt("أدخل Google Access Token (للمطورين) أو اضغط موافق للمحاكاة:");
    if (mockToken) setGoogleAccessToken(mockToken);
    else setGoogleAccessToken("simulation-token"); 
  };

  const handleCreateMeet = async (type: 'NOW' | 'SCHEDULED') => {
    if (!googleAccessToken) {
       alert("يرجى ربط حساب Google أولاً.");
       return;
    }
    setIsScheduling(true);
    const startTime = new Date().toISOString();
    let link = googleAccessToken === "simulation-token" 
        ? (await new Promise(r => setTimeout(r, 1000)), "https://meet.google.com/abc-defg-hij") 
        : await createGoogleMeetEvent(`مكالمة مجموعة ${group.name}`, startTime, 60, googleAccessToken);

    if (link) alert(type === 'NOW' ? `تم طلب مكالمة! الرابط: ${link}` : `تم جدولة المكالمة. الرابط: ${link}`);
    else alert("حدث خطأ.");
    setIsScheduling(false);
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    return `منذ ${hours} ساعة`;
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">{group.name}</h2>
        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{group.id}</span>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-200 rounded-xl mb-6 overflow-x-auto no-scrollbar">
        <button onClick={() => setSubTab('activity')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg ${subTab === 'activity' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>النشاط</button>
        <button onClick={() => setSubTab('members')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg ${subTab === 'members' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>الأعضاء</button>
        <button onClick={() => setSubTab('locations')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg ${subTab === 'locations' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>مواقع</button>
        <button onClick={() => setSubTab('meet')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg ${subTab === 'meet' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>مكالمة</button>
      </div>

      {/* ACTIVITY */}
      {subTab === 'activity' && (
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
               لا يوجد نشاط اليوم بعد.
            </div>
          ) : (
            logs.map((log) => (
               <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm animate-fade-in">
                  <div className="flex justify-between">
                     <h4 className="font-bold text-slate-800 text-sm">{log.userName}</h4>
                     <span className="text-xs text-slate-400">{formatTimeAgo(log.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{log.summary}</p>
                  {log.category && (
                    <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                       {log.category === 'STUDY' ? 'دراسة' : log.category === 'WELLBEING' ? 'ترويح' : 'عمل خير'}
                    </span>
                  )}
               </div>
            ))
          )}
        </div>
      )}

      {/* LOCATIONS */}
      {subTab === 'locations' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 mb-2">
            ℹ️ تعرض هنا المواقع الأخيرة للأعضاء الذين سمحوا بمشاركة موقعهم معك.
          </div>
          
          {members.filter(m => m.id !== user.id).length === 0 && (
             <p className="text-center text-slate-400 py-4">لا يوجد أعضاء آخرون.</p>
          )}

          {members.map(m => {
             const loc = locationPoints.find(p => p.userId === m.id);
             // In real app, Firestore Rules filter this. Here we just show what's in state.
             if (!loc && m.id !== user.id) return null; // Don't show if no location shared
             
             return (
               <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">{m.name[0]}</div>
                     <div>
                       <p className="font-bold text-slate-800">{m.name} {m.id === user.id ? '(أنت)' : ''}</p>
                       {loc ? (
                          <p className="text-xs text-emerald-600">
                            {formatTimeAgo(loc.timestamp)} • {loc.accuracyLabel}
                          </p>
                       ) : (
                          <p className="text-xs text-slate-400">لم يشارك الموقع</p>
                       )}
                     </div>
                  </div>
                  {loc && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"
                    >
                      🗺️
                    </a>
                  )}
               </div>
             );
          })}
        </div>
      )}

      {/* MEMBERS */}
      {subTab === 'members' && (
        <div className="space-y-4">
           {members.length === 1 && (
             <div className="p-6 bg-slate-50 border border-slate-100 rounded-xl text-center">
               <div className="text-4xl mb-3">👋</div>
               <p className="text-slate-800 font-bold mb-2">المجموعة هادئة!</p>
               <p className="text-slate-500 text-sm mb-4">لم ينضم أحد بعد.</p>
             </div>
           )}
           <div className="space-y-2">
             {members.map(m => (
               <div key={m.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">{m.name[0]}</div>
                  <span className="font-bold text-slate-700">{m.name} {m.id === user.id ? '(أنت)' : ''}</span>
                  {m.isAdmin && <span className="mr-auto text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded">مشرف</span>}
               </div>
             ))}
           </div>
           {user.isAdmin && (
             <div className="mt-8 pt-6 border-t border-slate-200">
               <h3 className="font-bold mb-3">إدارة الدعوات</h3>
               {inviteCode ? (
                 <div className="bg-slate-50 p-4 rounded-xl text-center">
                   <p className="text-xs text-slate-400 mb-1">رمز الانضمام</p>
                   <p className="text-3xl font-mono font-bold tracking-widest text-slate-800 mb-4 select-all">{inviteCode}</p>
                   <button onClick={() => { navigator.clipboard.writeText(inviteCode); alert('تم النسخ'); }} className="bg-white border border-slate-300 py-2 px-6 rounded-lg text-sm font-bold text-slate-700">نسخ</button>
                 </div>
               ) : (
                 <button onClick={handleGenerateInvite} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">إنشاء دعوة جديدة</button>
               )}
             </div>
           )}
        </div>
      )}

      {/* MEET */}
      {subTab === 'meet' && (
        <div className="space-y-6 text-center">
           {!googleAccessToken ? (
             <div className="py-10">
               <div className="text-4xl mb-4">🔐</div>
               <p className="text-slate-600 mb-6">يجب ربط حساب Google.</p>
               <button onClick={handleGoogleSignIn} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">ربط حساب Google</button>
             </div>
           ) : (
             <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => handleCreateMeet('NOW')} disabled={isScheduling} className="py-6 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                   <span className="text-2xl">📹</span><span>مكالمة الآن</span>
                 </button>
                 <button onClick={() => handleCreateMeet('SCHEDULED')} disabled={isScheduling} className="py-6 bg-white text-blue-600 border-2 border-blue-100 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                   <span className="text-2xl">📅</span><span>جدولة</span>
                 </button>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default GroupScreen;