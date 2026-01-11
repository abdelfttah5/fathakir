import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, Group, ActivityLog, ActivityType, LocationSettings } from '../types';
import { GOOD_DEEDS_CATEGORIES, PRAYERS_STRUCTURE } from '../constants';

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

const ActivityRing = ({ logs }: { logs: ActivityLog[] }) => {
  const [hoveredLog, setHoveredLog] = useState<string | null>(null);

  // Filter for today only
  const todayLogs = logs.filter(log => {
    const d = new Date(log.timestamp);
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth();
  });

  // Calculate segments
  const totalSlots = Math.max(todayLogs.length, 1); // Avoid division by zero
  const gap = 2; // Gap between segments in degrees
  const anglePerItem = (360 - (todayLogs.length * gap)) / totalSlots;

  // Colors mapping
  const getColor = (type: ActivityType) => {
    switch(type) {
      case ActivityType.PRAYER: return '#0ea5e9'; // Sky Blue
      case ActivityType.QURAN: return '#0d9488'; // Teal
      case ActivityType.DHIKR: return '#10b981'; // Emerald
      case ActivityType.GOOD_DEED: 
      case ActivityType.SADAQAH: return '#f59e0b'; // Amber
      case ActivityType.CHECKIN: return '#64748b'; // Slate
      default: return '#10b981';
    }
  };

  return (
    <div className="relative flex items-center justify-center w-48 h-48 mx-auto my-6">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Background Circle if empty */}
        {todayLogs.length === 0 && (
          <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="8" fill="none" />
        )}
        
        {/* Log Segments */}
        {todayLogs.map((log, index) => {
          const startAngle = index * (anglePerItem + gap);
          const endAngle = startAngle + anglePerItem;
          return (
            <path
              key={log.id}
              d={describeArc(50, 50, 40, startAngle, endAngle)}
              fill="none"
              stroke={getColor(log.type)}
              strokeWidth="8"
              className="cursor-pointer hover:opacity-80 transition-opacity"
              strokeLinecap="round"
              onMouseEnter={() => setHoveredLog(log.summary)}
              onMouseLeave={() => setHoveredLog(null)}
              onClick={() => setHoveredLog(log.summary)} // For mobile touch
            />
          );
        })}
      </svg>
      
      {/* Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
        {hoveredLog ? (
          <span className="text-sm font-bold text-slate-800 animate-fade-in break-words">{hoveredLog}</span>
        ) : todayLogs.length === 0 ? (
           <div className="flex flex-col items-center">
             <span className="text-2xl">🌱</span>
             <span className="text-[10px] text-slate-400 mt-1">لا نشاط</span>
           </div>
        ) : (
          <div className="flex flex-col items-center">
             <span className="text-3xl font-bold text-emerald-600">{todayLogs.length}</span>
             <span className="text-xs text-slate-500">أعمال اليوم</span>
          </div>
        )}
      </div>
    </div>
  );
};
// ------------------------------------

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
}

const TodayScreen: React.FC<TodayScreenProps> = ({ 
  user, group, logs, addLog, members, 
  locationSettings, updateLocationSettings, updateMyLocation, onNavigate 
}) => {
  const [showDeedModal, setShowDeedModal] = useState(false);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  
  // Good Deed State
  const [activeDeedTab, setActiveDeedTab] = useState(GOOD_DEEDS_CATEGORIES[0].value);
  const [customDeed, setCustomDeed] = useState('');
  
  // Location UI State
  const [isLocating, setIsLocating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // AUTO_ON_OPEN Logic
  useEffect(() => {
    const checkAutoLocation = async () => {
      if (locationSettings.pauseUntil && Date.now() < locationSettings.pauseUntil) {
        return;
      }
      if (locationSettings.mode === 'AUTO_ON_OPEN') {
        requestLocation(true); // Silent update
      }
    };
    checkAutoLocation();
  }, [locationSettings.mode, locationSettings.pauseUntil]);

  const requestLocation = (silent: boolean = false) => {
    if (!navigator.geolocation) {
      if (!silent) alert("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    
    if (!silent) setIsLocating(true);

    const options = {
      enableHighAccuracy: locationSettings.accuracy === 'PRECISE',
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracyLabel = locationSettings.accuracy === 'PRECISE' ? 'دقيق' : 'تقريبي';
        updateMyLocation(pos.coords.latitude, pos.coords.longitude, accuracyLabel);
        setLastUpdate(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
        if (!silent) setIsLocating(false);
      },
      (err) => {
        console.warn(err);
        if (!silent) {
           alert("تعذر تحديد الموقع. تأكد من تفعيل GPS والموافقة على الإذن.");
           setIsLocating(false);
        }
      },
      options
    );
  };

  const handleShareNow = () => {
    requestLocation();
  };

  const togglePause = (durationHours: number) => {
    const pauseUntil = Date.now() + (durationHours * 60 * 60 * 1000);
    updateLocationSettings({ pauseUntil });
    alert(`تم إيقاف المشاركة مؤقتًا لمدة ${durationHours} ساعة.`);
  };

  const handleSaveDeed = (item: string) => {
    addLog(ActivityType.GOOD_DEED, `سجّل عملًا: ${item}`, undefined, activeDeedTab);
    setShowDeedModal(false);
    setCustomDeed('');
  };

  const handleSaveCustomDeed = () => {
    if (!customDeed.trim()) return;
    
    let prefix = "سجّل عملًا";
    if (activeDeedTab === 'STUDY') prefix = "سجّل إنجازاً دراسياً";
    if (activeDeedTab === 'WELLBEING') prefix = "سجّل نشاطاً صحياً";

    // Updated to use activeDeedTab to correctly categorize the custom deed
    addLog(ActivityType.GOOD_DEED, `${prefix}: ${customDeed}`, undefined, activeDeedTab);
    setShowDeedModal(false);
    setCustomDeed('');
  };

  // Helper to record prayer
  const handleRecordPrayer = (name: string, type: 'FARD' | 'SUNNAH') => {
    const summary = type === 'FARD' ? `أدى صلاة ${name}` : `أدى ${name}`;
    addLog(ActivityType.PRAYER, summary);
    if (type === 'FARD') {
        alert(`تم تسجيل ${summary}`);
    } else {
        alert(`تم تسجيل ${summary}`);
    }
  };

  // Active Category Data for Deed Modal
  const currentDeedCategory = GOOD_DEEDS_CATEGORIES.find(c => c.value === activeDeedTab) || GOOD_DEEDS_CATEGORIES[0];

  const getCustomPlaceholder = () => {
    switch(activeDeedTab) {
        case 'STUDY': return 'مثال: بحث، تلخيص مادة...';
        case 'WELLBEING': return 'مثال: تأمل، استرخاء...';
        default: return 'مثال: صدقة، كلمة طيبة...';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Daily Reminder */}
      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-3 animate-fade-in">
        <span className="text-xl">💡</span>
        <p className="text-sm text-amber-800 font-medium">تذكير اليوم: جدد نيتك في كل عمل.</p>
      </div>

      {/* NEW DASHBOARD NAVIGATION */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={() => onNavigate('dhikr')}
          className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all hover:border-emerald-300 group"
        >
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-2xl group-hover:bg-emerald-100 transition-colors">
            📿
          </div>
          <span className="text-sm font-bold text-slate-700">الأذكار</span>
        </button>

        <button 
          onClick={() => onNavigate('read')}
          className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all hover:border-emerald-300 group"
        >
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl group-hover:bg-blue-100 transition-colors">
            📖
          </div>
          <span className="text-sm font-bold text-slate-700">أقرأ</span>
        </button>

        <button 
          onClick={() => onNavigate('group')}
          className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all hover:border-emerald-300 group"
        >
          <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-2xl group-hover:bg-purple-100 transition-colors">
            👥
          </div>
          <span className="text-sm font-bold text-slate-700">المجموعة</span>
        </button>
      </div>

      {/* Activity Ring Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-2">
           <h2 className="text-lg font-bold text-slate-800">نشاط اليوم</h2>
           <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">المؤشر تفاعلي</span>
        </div>
        
        <ActivityRing logs={logs} />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowDeedModal(true)}
          className="col-span-2 bg-emerald-600 text-white h-14 rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <span>❤️</span>
          <span>عمل صالح</span>
        </button>
        <button 
          onClick={() => setShowPrayerModal(true)} 
          className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:border-emerald-500 transition-colors"
        >
            🕌 سجل الصلاة
        </button>
        <button 
          onClick={() => addLog(ActivityType.CHECKIN, 'مشاركة اطمئنان')} 
          className="p-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:border-emerald-500 transition-colors"
        >
            📍 سجل تواجد
        </button>
      </div>

      {/* Reassurance (Location) Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span>📍</span> الاطمئنان
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
              مشاركة الموقع اختيارية للاطمئنان فقط وليست للمراقبة.
            </p>
          </div>
          <button onClick={() => setShowLocationSettings(!showLocationSettings)} className="text-slate-400 p-2">⚙️</button>
        </div>

        <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded flex justify-between items-center">
           <span>{lastUpdate ? `آخر تحديث: ${lastUpdate}` : 'لم يتم التحديث مؤخراً'}</span>
           {locationSettings.pauseUntil && Date.now() < locationSettings.pauseUntil && (
             <span className="text-orange-500 font-bold">موقوف مؤقتاً</span>
           )}
        </div>

        <div className="flex gap-2 mb-4">
           <button 
             onClick={handleShareNow}
             disabled={isLocating}
             className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg font-bold text-sm border border-blue-100"
           >
             {isLocating ? 'جاري التحديث...' : 'شارك موقعي الآن'}
           </button>
           
           <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
             <label className="text-xs font-bold text-slate-600 cursor-pointer">
                تحديث عند الفتح
             </label>
             <input 
               type="checkbox" 
               checked={locationSettings.mode === 'AUTO_ON_OPEN'}
               onChange={(e) => updateLocationSettings({ mode: e.target.checked ? 'AUTO_ON_OPEN' : 'OFF' })}
               className="w-4 h-4 text-emerald-600 rounded"
             />
           </div>
        </div>

        {showLocationSettings && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-slide-up">
             <div className="mb-4">
               <label className="block text-xs font-bold text-slate-700 mb-2">إيقاف مؤقت</label>
               <div className="flex gap-2">
                 {[1, 8, 24].map(h => (
                   <button key={h} onClick={() => togglePause(h)} className="flex-1 py-1.5 text-xs bg-orange-50 text-orange-700 rounded border border-orange-100">
                     {h} ساعة
                   </button>
                 ))}
                 <button onClick={() => updateLocationSettings({ pauseUntil: null })} className="px-3 py-1.5 text-xs text-slate-500">إلغاء</button>
               </div>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-700 mb-2">من يرى موقعي؟</label>
               <div className="flex gap-2 mb-2">
                 <button onClick={() => updateLocationSettings({ visibility: 'ALL' })} className={`flex-1 py-1.5 text-xs rounded border ${locationSettings.visibility === 'ALL' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200'}`}>الجميع</button>
                 <button onClick={() => updateLocationSettings({ visibility: 'SELECTED' })} className={`flex-1 py-1.5 text-xs rounded border ${locationSettings.visibility === 'SELECTED' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200'}`}>محددون</button>
               </div>
             </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Prayer Modal */}
      {showPrayerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPrayerModal(false)}>
          <div className="bg-white w-full max-w-md rounded-t-2xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-emerald-800 mb-4 font-amiri text-center border-b border-emerald-100 pb-2">الصلوات والرواتب</h3>
            
            <div className="space-y-4">
              {PRAYERS_STRUCTURE.map((prayer) => (
                <div key={prayer.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-slate-800 text-lg">{prayer.name}</span>
                    <button 
                      onClick={() => handleRecordPrayer(prayer.name, 'FARD')}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm active:scale-95 transition-transform"
                    >
                      تسجيل الفرض
                    </button>
                  </div>
                  {prayer.sunnah.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-3">
                      {prayer.sunnah.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">{s.label}</span>
                          <button 
                            onClick={() => handleRecordPrayer(s.label, 'SUNNAH')}
                            className="px-3 py-1 bg-white border border-emerald-200 text-emerald-700 text-xs rounded-lg hover:bg-emerald-50"
                          >
                            إتمام
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button onClick={() => setShowPrayerModal(false)} className="w-full mt-6 py-3 text-slate-500 font-bold">إغلاق</button>
          </div>
        </div>
      )}

      {/* Good Deed Modal - New Tabbed Design */}
      {showDeedModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDeedModal(false)}>
          <div className="bg-white w-full max-w-md h-[90vh] rounded-t-3xl flex flex-col animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="p-6 pb-2 shrink-0">
               <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4"></div>
               <h3 className="text-xl font-bold text-slate-800 text-center mb-4">تسجيل عمل صالح</h3>
               
               {/* Tabs */}
               <div className="flex bg-slate-100 p-1 rounded-xl">
                 {GOOD_DEEDS_CATEGORIES.map((cat) => (
                   <button
                     key={cat.value}
                     onClick={() => setActiveDeedTab(cat.value)}
                     className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                       activeDeedTab === cat.value 
                         ? 'bg-white text-emerald-700 shadow-sm' 
                         : 'text-slate-500'
                     }`}
                   >
                     {cat.label.split('/')[0]} 
                   </button>
                 ))}
               </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 pt-2">
               <div className="grid grid-cols-2 gap-3 mb-4">
                 {currentDeedCategory.items.map((item, idx) => (
                   <button
                     key={idx}
                     onClick={() => handleSaveDeed(item)}
                     className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors active:scale-95 text-center flex items-center justify-center min-h-[5rem]"
                   >
                     {item}
                   </button>
                 ))}
               </div>
            </div>

            {/* Custom Input - Fixed/Sticky Bottom via Flexbox */}
            <div className="p-4 border-t border-slate-100 bg-white pb-8 z-20 shrink-0">
              <label className="block text-xs font-bold text-slate-500 mb-2">إضافة عمل خاص:</label>
              <div className="flex gap-2">
                <input 
                   type="text" 
                   value={customDeed}
                   onChange={(e) => setCustomDeed(e.target.value)}
                   placeholder={getCustomPlaceholder()}
                   className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
                />
                <button 
                   onClick={handleSaveCustomDeed}
                   disabled={!customDeed.trim()}
                   className="px-6 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:bg-slate-300 transition-colors shadow-sm"
                >
                  تسجيل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodayScreen;