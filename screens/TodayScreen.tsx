
import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, Group, ActivityLog, ActivityType, LocationSettings } from '../types';
import { GOOD_DEEDS_CATEGORIES, PRAYERS_STRUCTURE, DAILY_REMINDERS } from '../constants';

// --- Activity Donut Chart Components ---
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  const d = [
    "M", start.x, start.y, 
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
  return d;
}

const ActivityRing = ({ logs, isDarkMode }: { logs: ActivityLog[], isDarkMode: boolean }) => {
  const [hoveredLog, setHoveredLog] = useState<string | null>(null);

  const todayLogs = logs.filter(log => {
    const d = new Date(log.timestamp);
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  });

  const totalSlots = Math.max(todayLogs.length, 1);
  const gap = 2;
  const anglePerItem = (360 - (todayLogs.length * gap)) / totalSlots;

  const getStroke = (type: ActivityType) => {
     switch(type) {
      case ActivityType.PRAYER: return '#0ea5e9'; 
      case ActivityType.QURAN: return '#8b5cf6'; 
      case ActivityType.DHIKR: return '#10b981'; 
      case ActivityType.GOOD_DEED: return '#f59e0b'; 
      case ActivityType.CHECKIN: return '#64748b'; 
      default: return '#10b981';
    }
  };

  return (
    <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {todayLogs.length === 0 && (
          <circle cx="50" cy="50" r="40" stroke={isDarkMode ? '#333' : '#e2e8f0'} strokeWidth="6" fill="none" opacity="0.5" />
        )}
        {todayLogs.map((log, index) => {
          const startAngle = index * (anglePerItem + gap);
          const endAngle = startAngle + anglePerItem;
          return (
            <path
              key={log.id}
              d={describeArc(50, 50, 40, startAngle, endAngle)}
              fill="none"
              stroke={getStroke(log.type)}
              strokeWidth="6"
              className="cursor-pointer hover:opacity-80 transition-opacity"
              strokeLinecap="round"
              onMouseEnter={() => setHoveredLog(log.summary)}
              onMouseLeave={() => setHoveredLog(null)}
              onClick={() => setHoveredLog(log.summary)}
            />
          );
        })}
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
        {hoveredLog ? (
          <span className={`text-[8px] font-bold animate-fade-in break-words leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{hoveredLog}</span>
        ) : todayLogs.length === 0 ? (
           <div className="flex flex-col items-center">
             <span className="text-xl opacity-50">🌱</span>
           </div>
        ) : (
          <div className="flex flex-col items-center">
             <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{todayLogs.length}</span>
             <span className={`text-[7px] ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>نشاط</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface TodayScreenProps {
  user: User;
  group: Group;
  logs: ActivityLog[];
  addLog: (type: ActivityType, summary: string, details?: string, category?: any) => void;
  members: User[];
  locationSettings: LocationSettings;
  updateLocationSettings: (settings: Partial<LocationSettings>) => void;
  updateMyLocation: (lat: number, lng: number, accuracyLabel: 'تقريبي' | 'دقيق') => void;
  onNavigate: (tab: string) => void;
  isDarkMode?: boolean;
}

const COUNTRIES = [
  { name: "سلطنة عمان", code: "Oman", cities: ["مسقط", "صلالة", "صحار", "نزوى", "صور"] },
  { name: "السعودية", code: "Saudi Arabia", cities: ["مكة", "المدينة", "الرياض", "جدة", "الدمام"] },
  { name: "مصر", code: "Egypt", cities: ["القاهرة", "الإسكندرية", "الجيزة"] },
  { name: "الإمارات", code: "United Arab Emirates", cities: ["دبي", "أبو ظبي", "الشارقة"] },
  { name: "الكويت", code: "Kuwait", cities: ["الكويت"] },
  { name: "قطر", code: "Qatar", cities: ["الدوحة"] },
  { name: "البحرين", code: "Bahrain", cities: ["المنامة"] },
  { name: "الأردن", code: "Jordan", cities: ["عمان", "الزرقاء"] },
];

const TodayScreen: React.FC<TodayScreenProps> = ({ 
  user, group, logs, addLog, members, 
  locationSettings, updateLocationSettings, updateMyLocation, onNavigate, isDarkMode = false
}) => {
  const [showDeedModal, setShowDeedModal] = useState(false);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [showTimesModal, setShowTimesModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false); 
  
  const [activeDeedTab, setActiveDeedTab] = useState(GOOD_DEEDS_CATEGORIES[0].value);
  const [customDeed, setCustomDeed] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Prayer Times State
  const [prayerTimes, setPrayerTimes] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default Oman
  const [selectedCity, setSelectedCity] = useState("صلالة"); // Default Salalah
  const [loadingPrayers, setLoadingPrayers] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hijriStr = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(today);
  const dayOfYear = Math.floor((Date.now() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyReminder = DAILY_REMINDERS[dayOfYear % DAILY_REMINDERS.length];

  // Logic to calculate Today's Stats for Report
  const todayLogs = logs.filter(log => {
    const d = new Date(log.timestamp);
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear() && log.userId === user.id;
  });

  const completedPrayers = todayLogs.filter(l => l.type === ActivityType.PRAYER && l.summary.includes('أدى صلاة')).map(l => {
     const match = l.summary.match(/أدى صلاة (.+)/);
     return match ? match[1] : '';
  });

  const dhikrCount = todayLogs.filter(l => l.type === ActivityType.DHIKR).length;
  const goodDeedsCount = todayLogs.filter(l => l.type === ActivityType.GOOD_DEED).length;

  useEffect(() => {
    const checkAutoLocation = async () => {
      if (locationSettings.pauseUntil && Date.now() < locationSettings.pauseUntil) return;
      if (locationSettings.mode === 'AUTO_ON_OPEN') requestLocation(true);
    };
    checkAutoLocation();
  }, [locationSettings.mode, locationSettings.pauseUntil]);

  // Fetch Prayer Times when Country/City changes
  useEffect(() => {
    fetchPrayerTimes();
  }, [selectedCountry, selectedCity]);

  const fetchPrayerTimes = async () => {
    setLoadingPrayers(true);
    try {
      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
      // Using Aladhan API
      const res = await fetch(`https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${selectedCity}&country=${selectedCountry.code}&method=4`);
      const data = await res.json();
      if (data.code === 200) {
        setPrayerTimes(data.data.timings);
      }
    } catch (error) {
      console.error("Failed to fetch prayers", error);
    } finally {
      setLoadingPrayers(false);
    }
  };

  const requestLocation = (silent: boolean = false) => {
    if (!navigator.geolocation) return;
    if (!silent) setIsLocating(true);
    const options = { enableHighAccuracy: locationSettings.accuracy === 'PRECISE', timeout: 10000, maximumAge: 0 };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracyLabel = locationSettings.accuracy === 'PRECISE' ? 'دقيق' : 'تقريبي';
        updateMyLocation(pos.coords.latitude, pos.coords.longitude, accuracyLabel);
        if (!silent) setIsLocating(false);
      },
      (err) => { console.warn(err); if (!silent) setIsLocating(false); },
      options
    );
  };

  const handleSaveDeed = (item: string) => {
    addLog(ActivityType.GOOD_DEED, `سجّل عملًا: ${item}`, undefined, activeDeedTab);
    setShowDeedModal(false);
    setCustomDeed('');
  };

  const handleSaveCustomDeed = () => {
    if (!customDeed.trim()) return;
    addLog(ActivityType.GOOD_DEED, `سجّل عملًا خاصًا: ${customDeed}`, undefined, activeDeedTab);
    setShowDeedModal(false);
    setCustomDeed('');
  };

  const handleRecordPrayer = (name: string, type: 'FARD' | 'SUNNAH') => {
    const summary = type === 'FARD' ? `أدى صلاة ${name}` : `أدى ${name}`;
    addLog(ActivityType.PRAYER, summary);
    if (type === 'FARD') alert(`تم تسجيل ${summary}`);
  };

  const currentDeedCategory = GOOD_DEEDS_CATEGORIES.find(c => c.value === activeDeedTab) || GOOD_DEEDS_CATEGORIES[0];

  return (
    <div className="p-4 space-y-4 pb-20">
      
      {/* Date Header */}
      <div className={`p-5 rounded-3xl shadow-sm text-center border ${isDarkMode ? 'bg-gradient-to-r from-teal-900/50 to-emerald-900/50 border-teal-800' : 'bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-100'}`}>
        <h2 className={`text-2xl font-bold font-amiri mb-1 ${isDarkMode ? 'text-teal-200' : 'text-teal-900'}`}>{dateStr}</h2>
        <p className={`text-sm opacity-90 font-amiri ${isDarkMode ? 'text-teal-400' : 'text-teal-700'}`}>{hijriStr}</p>
      </div>

      {/* Reminder */}
      <div className={`p-4 rounded-3xl flex items-start gap-3 shadow-sm border transition-all ${isDarkMode ? 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-800' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'}`}>
        <span className="text-xl mt-1">✨</span>
        <div>
           <p className={`text-xs font-bold mb-1 ${isDarkMode ? 'text-amber-300' : 'text-amber-600'}`}>تذكير اليوم</p>
           <p className={`text-sm font-medium leading-relaxed font-amiri ${isDarkMode ? 'text-gray-200' : 'text-amber-900'}`}>
             {dailyReminder}
           </p>
        </div>
      </div>

      {/* Activity Ring */}
      <div className={`rounded-3xl p-4 border flex items-center justify-between backdrop-blur-sm transition-all ${isDarkMode ? 'bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border-indigo-800' : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100'}`}>
         <div className="flex-1">
             <h2 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-indigo-200' : 'text-indigo-900'}`}>نشاطك اليومي</h2>
             <p className={`text-[10px] mb-3 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600/80'}`}>اضغط على الحلقة للتفاصيل</p>
             <button 
                onClick={() => setShowReportModal(true)} 
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-colors shadow-sm ${isDarkMode ? 'bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500' : 'bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-700'}`}
             >
                📊 حصاد اليوم
             </button>
         </div>
         <div className="flex-shrink-0">
            <ActivityRing logs={logs} isDarkMode={isDarkMode} />
         </div>
      </div>

      {/* Buttons Grid */}
      <div className="grid grid-cols-2 gap-4 my-6 justify-items-center">
        <button 
          onClick={() => onNavigate('dhikr')}
          className={`w-24 h-24 rounded-full border shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group hover:shadow-md ${isDarkMode ? 'bg-gradient-to-br from-emerald-900 to-teal-900 border-emerald-800' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-white text-emerald-600'}`}>📿</div>
          <span className={`text-xs font-bold ${isDarkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>الأذكار</span>
        </button>

        <button 
          onClick={() => onNavigate('read')}
          className={`w-24 h-24 rounded-full border shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group hover:shadow-md ${isDarkMode ? 'bg-gradient-to-br from-amber-900 to-orange-900 border-amber-800' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-white text-amber-600'}`}>📖</div>
          <span className={`text-xs font-bold ${isDarkMode ? 'text-amber-200' : 'text-amber-900'}`}>أقرأ</span>
        </button>

        <button 
          onClick={() => onNavigate('group')}
          className={`w-24 h-24 rounded-full border shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group hover:shadow-md ${isDarkMode ? 'bg-gradient-to-br from-violet-900 to-purple-900 border-violet-800' : 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-violet-400' : 'bg-white text-violet-600'}`}>👥</div>
          <span className={`text-xs font-bold ${isDarkMode ? 'text-violet-200' : 'text-violet-900'}`}>المجموعة</span>
        </button>

        <button 
          onClick={() => setShowTimesModal(true)}
          className={`w-24 h-24 rounded-full border shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group hover:shadow-md ${isDarkMode ? 'bg-gradient-to-br from-sky-900 to-cyan-900 border-sky-800' : 'bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-100'}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-sky-400' : 'bg-white text-sky-600'}`}>🕌</div>
          <span className={`text-xs font-bold ${isDarkMode ? 'text-sky-200' : 'text-sky-900'}`}>المواقيت</span>
        </button>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowDeedModal(true)}
          className="col-span-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white h-14 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200/50 active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <span>❤️</span>
          <span>تسجيل عمل صالح</span>
        </button>

        <button 
          onClick={() => setShowPrayerModal(true)} 
          className={`p-4 border rounded-2xl font-bold transition-colors shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-rose-900/40 to-pink-900/40 border-rose-800 text-rose-200' : 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100 text-rose-700 hover:from-rose-100 hover:to-pink-100'}`}
        >
            🕌 سجل الصلاة
        </button>

        <button 
          onClick={() => updateLocationSettings({ mode: locationSettings.mode === 'OFF' ? 'AUTO_ON_OPEN' : 'OFF' })}
          className={`p-4 rounded-2xl font-bold transition-colors shadow-sm border ${
            locationSettings.mode === 'AUTO_ON_OPEN' 
              ? (isDarkMode ? 'bg-emerald-900/60 border-emerald-700 text-emerald-300' : 'bg-emerald-100 border-emerald-300 text-emerald-800') 
              : (isDarkMode ? 'bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-800 text-emerald-200' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 text-emerald-700 hover:from-emerald-100 hover:to-teal-100')
          }`}
        >
            {locationSettings.mode === 'AUTO_ON_OPEN' ? '📡 التتبع مفعل' : '📡 تفعيل التتبع'}
        </button>
      </div>

      {/* --- REPORT MODAL --- */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowReportModal(false)}>
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-hidden relative flex flex-col max-h-[85vh] ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`} onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
            <h3 className="text-xl font-bold text-center mb-4 mt-2 shrink-0">📊 حصاد اليوم</h3>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                {/* STATS GRID */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}>
                     <div className="text-2xl mb-1">📿</div>
                     <div className="text-lg font-bold text-emerald-600">{dhikrCount}</div>
                     <div className="text-[10px] opacity-70">أذكار</div>
                  </div>
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                     <div className="text-2xl mb-1">🕌</div>
                     <div className="text-lg font-bold text-blue-600">{completedPrayers.length} / 5</div>
                     <div className="text-[10px] opacity-70">صلوات</div>
                  </div>
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
                     <div className="text-2xl mb-1">❤️</div>
                     <div className="text-lg font-bold text-amber-600">{goodDeedsCount}</div>
                     <div className="text-[10px] opacity-70">أعمال</div>
                  </div>
                </div>

                {/* PRAYERS CHECKLIST (Summary) */}
                <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                   <h4 className="text-sm font-bold mb-3 border-b pb-2 opacity-80 border-slate-200/20">تفقد الصلوات</h4>
                   <div className="space-y-2">
                     {PRAYERS_STRUCTURE.map(p => {
                        const isDone = completedPrayers.includes(p.name);
                        return (
                          <div key={p.id} className="flex justify-between items-center">
                            <span className="text-sm">{p.name}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                              {isDone ? '✅' : '⭕'}
                            </span>
                          </div>
                        );
                     })}
                   </div>
                </div>

                {/* FULL LOGS (The requested feature) */}
                <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                   <h4 className="text-sm font-bold mb-3 border-b pb-2 opacity-80 border-slate-200/20">سجل النشاط الكامل</h4>
                   <div className="space-y-2">
                     {todayLogs.length === 0 ? (
                        <p className="text-xs text-center opacity-50">لم يتم تسجيل نشاط بعد</p>
                     ) : (
                        todayLogs.sort((a, b) => b.timestamp - a.timestamp).map(log => (
                          <div key={log.id} className={`p-3 rounded-lg text-xs flex justify-between items-start gap-2 ${isDarkMode ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                            <div className="flex flex-col gap-1 text-right flex-1">
                                <span className="font-bold">{log.summary}</span>
                                {log.details && <span className="opacity-70 text-[10px]">{log.details}</span>}
                            </div>
                            <span className={`opacity-50 font-mono text-[10px] whitespace-nowrap bg-black/5 px-1 rounded ${isDarkMode ? 'text-gray-400 bg-white/5' : 'text-slate-500'}`}>
                                {new Date(log.timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        ))
                     )}
                   </div>
                </div>
            </div>

            <button onClick={() => setShowReportModal(false)} className="w-full mt-4 py-3 rounded-xl bg-slate-200 text-slate-800 font-bold hover:bg-slate-300 transition-colors shrink-0">
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* --- PRAYER TIMES MODAL --- */}
      {showTimesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowTimesModal(false)}>
           <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-hidden relative ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200/20">
                 <h3 className="text-xl font-bold">مواقيت الصلاة 🕌</h3>
                 <button onClick={() => setShowTimesModal(false)} className="w-8 h-8 rounded-full bg-slate-200/20 flex items-center justify-center">✕</button>
              </div>

              <div className="flex gap-2 mb-6">
                 <select 
                   value={selectedCountry.code} 
                   onChange={(e) => {
                     const c = COUNTRIES.find(x => x.code === e.target.value);
                     if (c) {
                       setSelectedCountry(c);
                       setSelectedCity(c.cities[0]); 
                     }
                   }}
                   className={`flex-1 p-2 rounded-lg text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                 >
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                 </select>
                 <select 
                   value={selectedCity} 
                   onChange={(e) => setSelectedCity(e.target.value)}
                   className={`flex-1 p-2 rounded-lg text-sm font-bold outline-none ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                 >
                    {selectedCountry.cities.map(city => <option key={city} value={city}>{city}</option>)}
                 </select>
              </div>

              {loadingPrayers ? (
                 <div className="py-10 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-2 text-sm opacity-70">جاري التحديث...</p>
                 </div>
              ) : prayerTimes ? (
                 <div className="space-y-3">
                    {['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((pName) => (
                       <div key={pName} className={`flex justify-between items-center p-3 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                          <span className="font-bold">
                            {pName === 'Fajr' ? 'الفجر' : pName === 'Sunrise' ? 'الشروق' : pName === 'Dhuhr' ? 'الظهر' : pName === 'Asr' ? 'العصر' : pName === 'Maghrib' ? 'المغرب' : 'العشاء'}
                          </span>
                          <span className={`font-mono font-bold ${pName === 'Sunrise' ? 'opacity-60' : 'text-emerald-500'}`}>{prayerTimes[pName]}</span>
                       </div>
                    ))}
                    <p className="text-[10px] text-center opacity-50 mt-4">حسب التوقيت المحلي لـ {selectedCity}، {selectedCountry.name}</p>
                 </div>
              ) : (
                 <p className="text-center py-4 text-red-400">تعذر تحميل الأوقات</p>
              )}
           </div>
        </div>
      )}

      {/* --- RECORD PRAYER MODAL --- */}
      {showPrayerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPrayerModal(false)}>
          <div className={`w-full max-w-md rounded-t-3xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-slate-400/30 rounded-full mx-auto mb-6"></div>
            <h3 className={`text-xl font-bold mb-4 font-amiri text-center ${isDarkMode ? 'text-sky-400' : 'text-sky-800'}`}>الصلوات والرواتب</h3>
            <div className="space-y-4">
              {PRAYERS_STRUCTURE.map((prayer) => (
                <div key={prayer.id} className={`rounded-xl p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold">{prayer.name}</span>
                    <button onClick={() => handleRecordPrayer(prayer.name, 'FARD')} className="px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg shadow-sm active:scale-95">تسجيل الفرض</button>
                  </div>
                  {prayer.sunnah.length > 0 && (
                    <div className={`grid grid-cols-1 gap-2 border-t pt-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      {prayer.sunnah.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</span>
                          <button onClick={() => handleRecordPrayer(s.label, 'SUNNAH')} className={`px-3 py-1 text-xs rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-sky-300' : 'bg-white border-sky-200 text-sky-700'}`}>إتمام</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM GOOD DEED MODAL (UPDATED) --- */}
      {showDeedModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeedModal(false)}>
          <div className={`w-full max-w-md h-[80vh] rounded-t-3xl flex flex-col animate-slide-up shadow-2xl ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}`} onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-2 shrink-0">
               <div className="w-12 h-1 bg-slate-400/30 rounded-full mx-auto mb-4"></div>
               <h3 className="text-xl font-bold text-center mb-4">تسجيل عمل صالح</h3>
               
               {/* Categories Tab */}
               <div className={`flex p-1 rounded-xl mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                 {GOOD_DEEDS_CATEGORIES.map((cat) => (
                   <button key={cat.value} onClick={() => setActiveDeedTab(cat.value)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeDeedTab === cat.value ? (isDarkMode ? 'bg-slate-700 text-sky-400 shadow-sm' : 'bg-white text-sky-700 shadow-sm') : 'text-slate-500'}`}>
                     {cat.label.split('/')[0]} 
                   </button>
                 ))}
               </div>

               {/* NEW: Custom Input Field */}
               <div className="flex gap-2 mb-2">
                 <input 
                    type="text" 
                    value={customDeed}
                    onChange={(e) => setCustomDeed(e.target.value)}
                    placeholder="أو اكتب عملك الصالح هنا..."
                    className={`flex-1 p-3 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                 />
                 <button 
                    onClick={handleSaveCustomDeed}
                    disabled={!customDeed.trim()}
                    className="px-4 bg-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-50"
                 >
                    حفظ
                 </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pt-2">
               <div className="grid grid-cols-2 gap-3 mb-4">
                 {currentDeedCategory.items.map((item, idx) => (
                   <button key={idx} onClick={() => handleSaveDeed(item)} className={`p-4 border rounded-xl text-sm font-bold transition-colors active:scale-95 text-center flex items-center justify-center min-h-[4rem] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-sky-50 border-sky-100 text-slate-700 hover:bg-sky-100'}`}>
                     {item}
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodayScreen;
