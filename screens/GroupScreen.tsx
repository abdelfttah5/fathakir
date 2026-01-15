
import * as React from 'react';
import { useState } from 'react';
import { User, Group, ActivityLog, LocationPoint } from '../types';
import { createGoogleMeetEvent } from '../services/api';
import { updateGroupCode } from '../services/firebase';

interface GroupScreenProps {
  user: User;
  group: Group;
  members: User[];
  logs: ActivityLog[];
  locationPoints: LocationPoint[];
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string) => void;
  onLeaveGroup?: () => void;
  isDarkMode?: boolean;
}

const GroupScreen: React.FC<GroupScreenProps> = ({ 
  user, group, members, logs, locationPoints, googleAccessToken, setGoogleAccessToken, onLeaveGroup, isDarkMode = false
}) => {
  // SAFETY CHECK: If critical data is missing, render a fallback instead of crashing
  if (!user || !group) {
    return (
      <div className="p-8 text-center opacity-50">
        <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        جاري تحميل بيانات المجموعة...
      </div>
    );
  }

  const [subTab, setSubTab] = useState<'activity' | 'members' | 'locations' | 'meet'>('activity');
  const [inviteCode, setInviteCode] = useState<string | null>(group.inviteCode || null);
  const [isScheduling, setIsScheduling] = useState(false);

  const isAdmin = user.isAdmin || (group.id && user.id === group.adminId);
  const safeGroupId = group.id ? group.id.toString() : 'unknown';
  const displayId = safeGroupId.length > 8 ? safeGroupId.substring(0, 8) : safeGroupId;

  // --- LOGIC ---
  const handleGenerateInvite = async () => {
    if (!isAdmin) return;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Save to State and DB
    setInviteCode(newCode);
    if (group.id) {
        await updateGroupCode(group.id, newCode);
    }
    
    alert(`تم إنشاء وحفظ رمز الدعوة: ${newCode}`);
  };

  const handleCopyLink = () => {
    if (!inviteCode) return;
    
    // RADICAL FIX: Encode group data to ensure joining works in Mock Mode across browsers
    const groupPayload = btoa(JSON.stringify({ 
      id: group.id, 
      name: group.name, 
      inviteCode: inviteCode 
    }));

    // Generate Direct Link with encoded data
    const directLink = `${window.location.origin}${window.location.pathname}?inviteCode=${inviteCode}&d=${groupPayload}`;
    navigator.clipboard.writeText(directLink);
    alert('تم نسخ رابط الدعوة المباشر:\n' + directLink);
  };

  const handleCreateMeet = async (type: 'NOW' | 'SCHEDULED') => {
    setIsScheduling(true);
    const startTime = new Date().toISOString();
    
    const link = await createGoogleMeetEvent(`مكالمة مجموعة ${group.name || 'العائلة'}`, startTime, 60, "simulated-token");

    if (link) {
        if (type === 'NOW') {
            window.open(link, '_blank');
        } else {
            alert(`تم جدولة المكالمة. الرابط: ${link}`);
        }
    } else {
        alert("حدث خطأ أثناء إنشاء الرابط.");
    }
    setIsScheduling(false);
  };

  const handleLeave = () => {
    if (confirm("هل أنت متأكد من مغادرة المجموعة؟ ستفقد الوصول إلى النشاط والمواقع.")) {
       if (onLeaveGroup) onLeaveGroup();
    }
  };

  const handleCreateNew = () => {
    if (confirm("لإنشاء مجموعة جديدة، يجب عليك مغادرة المجموعة الحالية أولاً. هل تريد المتابعة؟")) {
       if (onLeaveGroup) onLeaveGroup();
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    return `منذ ${hours} ساعة`;
  };

  const theme = {
    card: isDarkMode ? 'bg-[#2a2a2a] border-[#333]' : 'bg-white border-slate-100',
    text: isDarkMode ? 'text-gray-200' : 'text-slate-800',
    subText: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    tabActive: isDarkMode ? 'bg-[#333] text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm',
    tabInactive: isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700',
    tabBar: isDarkMode ? 'bg-[#1e1e1e]' : 'bg-slate-200',
    emptyState: isDarkMode ? 'bg-[#2a2a2a] border-slate-700 text-gray-500' : 'bg-white border-slate-200 text-slate-400'
  };

  const safeMembers = Array.isArray(members) ? members : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-xl font-bold ${theme.text}`}>{group.name || 'مجموعة'}</h2>
        <span className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-[#333] text-gray-400' : 'bg-slate-100 text-slate-500'}`}>{displayId}...</span>
      </div>

      {/* Tabs */}
      <div className={`flex p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar ${theme.tabBar}`}>
        <button onClick={() => setSubTab('activity')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg transition-all ${subTab === 'activity' ? theme.tabActive : theme.tabInactive}`}>النشاط</button>
        <button onClick={() => setSubTab('members')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg transition-all ${subTab === 'members' ? theme.tabActive : theme.tabInactive}`}>الأعضاء</button>
        <button onClick={() => setSubTab('locations')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg transition-all ${subTab === 'locations' ? theme.tabActive : theme.tabInactive}`}>مواقع</button>
        <button onClick={() => setSubTab('meet')} className={`flex-1 min-w-[70px] py-2 text-sm font-bold rounded-lg transition-all ${subTab === 'meet' ? theme.tabActive : theme.tabInactive}`}>مكالمة</button>
      </div>

      {/* ACTIVITY */}
      {subTab === 'activity' && (
        <div className="space-y-4">
          {safeLogs.length === 0 ? (
            <div className={`text-center py-8 rounded-xl border border-dashed ${theme.emptyState}`}>
               لا يوجد نشاط اليوم بعد.
            </div>
          ) : (
            safeLogs.map((log) => (
               <div key={log.id || Math.random()} className={`p-4 rounded-xl border shadow-sm animate-fade-in ${theme.card}`}>
                  <div className="flex justify-between">
                     <h4 className={`font-bold text-sm ${theme.text}`}>{log.userName || 'عضو'}</h4>
                     <span className={`text-xs ${theme.subText}`}>{formatTimeAgo(log.timestamp)}</span>
                  </div>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>{log.summary}</p>
                  {log.category && (
                    <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
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
          <div className={`p-4 border rounded-xl text-sm mb-2 ${isDarkMode ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
            ℹ️ تعرض هنا المواقع الأخيرة للأعضاء الذين سمحوا بمشاركة موقعهم معك.
          </div>
          
          {safeMembers.filter(m => m.id !== user.id).length === 0 && (
             <p className={`text-center py-4 ${theme.subText}`}>لا يوجد أعضاء آخرون.</p>
          )}

          {safeMembers.map(m => {
             const loc = locationPoints.find(p => p.userId === m.id);
             if (!loc && m.id !== user.id) return null; 
             
             return (
               <div key={m.id || Math.random()} className={`p-4 rounded-xl border flex items-center justify-between ${theme.card}`}>
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isDarkMode ? 'bg-[#333] text-gray-300' : 'bg-slate-100 text-slate-600'}`}>{m.name ? m.name[0] : '?'}</div>
                     <div>
                       <p className={`font-bold ${theme.text}`}>{m.name} {m.id === user.id ? '(أنت)' : ''}</p>
                       {loc ? (
                          <p className="text-xs text-emerald-600">
                            {formatTimeAgo(loc.timestamp)} • {loc.accuracyLabel}
                          </p>
                       ) : (
                          <p className={`text-xs ${theme.subText}`}>لم يشارك الموقع</p>
                       )}
                     </div>
                  </div>
                  {loc && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
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
           {safeMembers.length <= 1 && (
             <div className={`p-6 border rounded-xl text-center ${isDarkMode ? 'bg-[#2a2a2a] border-[#333]' : 'bg-slate-50 border-slate-100'}`}>
               <div className="text-4xl mb-3">👋</div>
               <p className={`font-bold mb-2 ${theme.text}`}>المجموعة هادئة!</p>
               <p className={`text-sm mb-4 ${theme.subText}`}>لم ينضم أحد بعد. شارك الرمز لدعوة عائلتك.</p>
             </div>
           )}
           <div className="space-y-2">
             {safeMembers.map(m => (
               <div key={m.id || Math.random()} className={`flex items-center gap-3 p-3 rounded-xl border ${theme.card}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isDarkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>{m.name ? m.name[0] : '?'}</div>
                  <span className={`font-bold ${theme.text}`}>{m.name} {m.id === user.id ? '(أنت)' : ''}</span>
                  {(m.isAdmin || (group.id && m.id === group.adminId)) && <span className={`mr-auto text-[10px] px-2 py-1 rounded ${isDarkMode ? 'bg-[#333] text-gray-400' : 'bg-slate-100 text-slate-500'}`}>مشرف</span>}
               </div>
             ))}
           </div>
           
           {/* Admin & Invites */}
           {isAdmin && (
             <div className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-[#333]' : 'border-slate-200'}`}>
               <h3 className={`font-bold mb-3 ${theme.text}`}>إدارة الدعوات (أنت المشرف)</h3>
               {inviteCode ? (
                 <div className={`p-4 rounded-xl text-center ${isDarkMode ? 'bg-[#2a2a2a]' : 'bg-slate-50'}`}>
                   <p className={`text-xs mb-1 ${theme.subText}`}>رمز الانضمام</p>
                   <p className={`text-3xl font-mono font-bold tracking-widest mb-4 select-all ${theme.text}`}>{inviteCode}</p>
                   <div className="flex gap-2 justify-center">
                     <button onClick={() => { navigator.clipboard.writeText(inviteCode); alert('تم نسخ الرمز'); }} className={`border py-2 px-6 rounded-lg text-sm font-bold flex-1 ${isDarkMode ? 'bg-[#333] border-[#444] text-white' : 'bg-white border-slate-300 text-slate-700'}`}>نسخ الرمز</button>
                     <button onClick={handleCopyLink} className={`py-2 px-6 rounded-lg text-sm font-bold flex-1 ${isDarkMode ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white'}`}>نسخ رابط الدعوة</button>
                   </div>
                   <p className={`text-[10px] mt-3 ${theme.subText}`}>أخبر عائلتك بتحميل التطبيق واختيار "انضمام لمجموعة" ثم إدخال هذا الرمز.</p>
                 </div>
               ) : (
                 <button onClick={handleGenerateInvite} className={`w-full py-3 rounded-xl font-bold shadow-lg ${isDarkMode ? 'bg-emerald-700 text-white shadow-emerald-900/50' : 'bg-slate-800 text-white shadow-slate-300'}`}>✨ إنشاء رمز دعوة الآن</button>
               )}
             </div>
           )}

           {/* Instructions for Non-Admins if code exists */}
           {!isAdmin && inviteCode && (
              <div className={`mt-4 p-4 rounded-xl text-center text-xs ${isDarkMode ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-800'}`}>
                 رمز المجموعة: <strong>{inviteCode}</strong> (شارك هذا الرمز مع من تريد إضافته)
              </div>
           )}

           {/* Separate Buttons for Leave and Create */}
           <div className="mt-8 flex flex-col gap-3">
              <button 
                onClick={handleCreateNew}
                className={`w-full py-3 rounded-xl font-bold border transition-colors text-sm flex items-center justify-center gap-2 ${isDarkMode ? 'bg-emerald-900/40 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}
              >
                <span>✨</span> إنشاء مجموعة جديدة
              </button>

              <button 
                onClick={handleLeave}
                className="w-full py-3 rounded-xl font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-colors text-sm"
              >
                مغادرة المجموعة
              </button>
           </div>
        </div>
      )}

      {/* MEET */}
      {subTab === 'meet' && (
        <div className="space-y-6 text-center">
             <div className="py-10">
               <div className="text-4xl mb-4">📹</div>
               <p className={`mb-6 ${theme.subText}`}>بدء مكالمة فيديو مع أعضاء المجموعة عبر Google Meet</p>
               
               <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => handleCreateMeet('NOW')} disabled={isScheduling} className="py-6 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200/50 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                     <span className="text-2xl">⚡</span><span>مكالمة الآن</span>
                   </button>
                   <button onClick={() => handleCreateMeet('SCHEDULED')} disabled={isScheduling} className={`py-6 border-2 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform ${isDarkMode ? 'bg-[#2a2a2a] border-blue-800 text-blue-400' : 'bg-white text-blue-600 border-blue-100'}`}>
                     <span className="text-2xl">📅</span><span>جدولة</span>
                   </button>
               </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default GroupScreen;
