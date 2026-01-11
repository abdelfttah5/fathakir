import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { User, ActivityType, AzkarJSON, ZekrItem } from '../types';
import { TASBIH_FIXED_LIST } from '../constants';
import { fetchAllAzkarDB, clearAzkarCache } from '../services/api';

interface DhikrScreenProps {
  user: User;
  addLog: (type: ActivityType, summary: string, details?: string) => void;
}

// Grid structure - Keys must exactly match STATIC_AZKAR keys or handled in normalization
const GRID_ITEMS = [
  { label: 'أذكار الصباح', icon: '☀️' },
  { label: 'أذكار المساء', icon: '🌙' },
  { label: 'تسابيح', icon: '📿', isSpecial: true },
  { label: 'أذكار بعد الصلاة', icon: '🤲' },
  { label: 'أذكار الاستيقاظ', icon: '🌅' },
  { label: 'أذكار النوم', icon: '🛌' },
  { label: 'أذكار الصلاة', icon: '🕌' },
  { label: 'أذكار الآذان', icon: '📢' },
  { label: 'أذكار المسجد', icon: '🕋' },
  { label: 'أذكار الوضوء', icon: '💧' },
  { label: 'أذكار المنزل', icon: '🏠' },
  { label: 'أذكار الخلاء', icon: '🚽' },
  { label: 'أذكار الطعام', icon: '🍽️' },
  { label: 'أذكار الحج والعمرة', icon: '🕋' },
  { label: 'دعاء ختم القرآن الكريم', icon: '📖' },
  { label: 'الأدعية القرآنية', icon: '📜' },
  { label: 'أدعية الأنبياء', icon: '✨' },
  { label: 'الرقية الشرعية', icon: '🛡️' },
  { label: 'أذكار متفرقة', icon: '🌸' },
  { label: 'جوامع الدعاء', icon: '🤲' },
  { label: 'فضل الدعاء', icon: '💎' },
  { label: 'فضل الذكر', icon: '❤️' },
  { label: 'فضل القرآن', icon: '⭐' },
  { label: 'فضل السور', icon: '🌟' },
  { label: 'أسماء الله الحسنى', icon: 'ﷻ' },
  { label: 'أدعية للميت', icon: '⚰️' },
];

const DhikrScreen: React.FC<DhikrScreenProps> = ({ user, addLog }) => {
  const [azkarDB, setAzkarDB] = useState<AzkarJSON | null>(null);
  
  // Data Loading State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Navigation State
  const [mode, setMode] = useState<'menu' | 'session' | 'tasbih'>('menu');
  const [activeSession, setActiveSession] = useState<{ title: string; items: ZekrItem[] } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Counter State for specific session
  const [remainingCount, setRemainingCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Tasbih Local State (Remaining Counts)
  const [tasbihCounts, setTasbihCounts] = useState<Record<number, number>>({});

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Update remaining count when current index changes
  useEffect(() => {
    if (activeSession && activeSession.items[currentIndex]) {
      const item = activeSession.items[currentIndex];
      let target = 1;
      if (typeof item.count === 'string') {
        target = parseInt(item.count) || 1;
      } else {
        target = item.count;
      }
      setRemainingCount(target);
      setIsCompleted(false);
    }
  }, [currentIndex, activeSession]);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchAllAzkarDB();
      if (data && Object.keys(data).length > 0) {
        setAzkarDB(data);
      } else {
        throw new Error("No valid data returned");
      }
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    clearAzkarCache();
    await loadData();
  };

  const handleGridItemClick = (label: string, isSpecial?: boolean) => {
    if (isSpecial && label === 'تسابيح') {
      setMode('tasbih');
      return;
    }

    if (!azkarDB) {
        alert("جاري تحميل البيانات، يرجى الانتظار...");
        return;
    }

    // Robust Search Strategy
    let items = azkarDB[label];

    if (!items) {
       // Try partial match if exact key fails
       const foundKey = Object.keys(azkarDB).find(k => k.includes(label) || label.includes(k));
       if (foundKey) items = azkarDB[foundKey];
    }

    // Special fix for Post Prayer if mapping differs slightly
    if (!items && label === 'أذكار بعد الصلاة') {
        const key = Object.keys(azkarDB).find(k => k.includes('بعد الصلاة'));
        if (key) items = azkarDB[key];
    }

    if (items && items.length > 0) {
      setActiveSession({ title: label, items });
      setCurrentIndex(0);
      setMode('session');
    } else {
      console.log("Available keys:", Object.keys(azkarDB));
      alert(`عذراً، محتوى "${label}" غير متوفر حالياً في المصدر.`);
    }
  };

  const handleSearchResultClick = (items: ZekrItem[], startIndex: number) => {
    setActiveSession({ title: 'نتائج البحث', items });
    setCurrentIndex(startIndex);
    setMode('session');
  };

  // --- Search Logic & Normalization ---
  
  const normalizeArabic = (text: string) => {
    // 1. Remove Tashkeel (Diacritics)
    // Range includes Fathatan, Dammatan, Kasratan, Fatha, Damma, Kasra, Shadda, Sukun, etc.
    let normalized = text.replace(/[\u064B-\u065F\u0670]/g, '');
    
    // 2. Normalize Alef forms (أ, إ, آ -> ا)
    normalized = normalized.replace(/[أإآ]/g, 'ا');
    
    // 3. Normalize Taa Marbuta (ة -> ه)
    normalized = normalized.replace(/ة/g, 'ه');
    
    // 4. Normalize Ya (ى -> ي)
    normalized = normalized.replace(/ى/g, 'ي');
    
    return normalized;
  };

  const searchResults = useMemo(() => {
    if (!azkarDB || !searchQuery.trim()) return [];
    
    const queryNorm = normalizeArabic(searchQuery.trim());
    const results: ZekrItem[] = [];
    
    Object.keys(azkarDB).forEach(key => {
      const categoryItems = azkarDB[key];
      categoryItems.forEach(item => {
        const itemZekrNorm = normalizeArabic(item.zekr);
        const itemDescNorm = item.description ? normalizeArabic(item.description) : '';
        
        // Search in both text and description using normalized forms
        if (itemZekrNorm.includes(queryNorm) || itemDescNorm.includes(queryNorm)) {
          results.push({ ...item, category: item.category || key });
        }
      });
    });
    
    return results;
  }, [azkarDB, searchQuery]);

  // --- Session Handlers ---
  
  const handleCounterClick = (e?: React.MouseEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    
    if (remainingCount > 0) {
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
      
      const newCount = remainingCount - 1;
      setRemainingCount(newCount);
      
      if (newCount === 0) {
         setIsCompleted(true);
         // Auto advance after short delay for satisfaction
         setTimeout(() => {
           handleNext();
         }, 400); 
      }
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (activeSession && currentIndex < activeSession.items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishSession();
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const finishSession = () => {
    if (activeSession) {
      addLog(ActivityType.DHIKR, `أتم ${activeSession.title}`);
    }
    setMode('menu');
    setActiveSession(null);
  };

  // --- Tasbih Handlers ---
  const decrementTasbih = (index: number, startCount: number) => {
    setTasbihCounts(prev => {
        const current = prev[index] !== undefined ? prev[index] : startCount;
        if (current <= 0) return prev;
        return { ...prev, [index]: current - 1 };
    });
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const resetTasbih = (index: number, startCount: number) => {
    // Reset immediately to the start count (e.g., 100)
    setTasbihCounts(prev => ({ ...prev, [index]: startCount }));
  };

  // --- UI RENDERERS ---

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] text-emerald-600 gap-4">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="font-bold">جاري تحميل الأذكار...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] text-slate-500 gap-4 p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="font-bold text-slate-800">تعذر تحميل البيانات</p>
        <button 
          onClick={handleRefresh}
          className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold mt-2 shadow-lg"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // 1. SESSION MODE (Reading Azkar with Countdown)
  if (mode === 'session' && activeSession) {
    const currentZekr = activeSession.items[currentIndex];
    const progress = ((currentIndex + 1) / activeSession.items.length) * 100;
    
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] p-4 select-none">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setMode('menu')} className="text-slate-500 px-2 py-1 bg-slate-100 rounded-lg text-sm font-bold">خروج</button>
          <span className="font-bold text-emerald-800 text-sm truncate max-w-[150px]">{activeSession.title}</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg font-bold">{currentIndex + 1} / {activeSession.items.length}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
          <div className="bg-emerald-500 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Zekr Card - NOW CLICKABLE ANYWHERE */}
        <div 
           onClick={handleCounterClick}
           className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
             <p className="text-2xl md:text-3xl leading-loose font-amiri text-center text-slate-800 dir-rtl">
               {currentZekr.zekr}
             </p>
             
             {currentZekr.description && (
                <p className="mt-6 text-sm text-emerald-600 text-center border-t border-slate-50 pt-4 font-bold bg-emerald-50/50 p-2 rounded-xl">{currentZekr.description}</p>
             )}

             {currentZekr.reference && (
                <p className="mt-2 text-[10px] text-slate-400 text-center">{currentZekr.reference}</p>
             )}
          </div>
          
          {/* Floating Action Area / Counter */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 border-t border-slate-100 flex items-center justify-between pointer-events-none">
             {/* Note: Buttons have pointer-events-auto to override parent click */}
             <button 
                onClick={handlePrev} 
                disabled={currentIndex === 0}
                className="w-12 h-12 flex items-center justify-center text-slate-400 disabled:opacity-30 text-2xl hover:bg-slate-50 rounded-full pointer-events-auto"
             >
               ➔
             </button>

             {/* The BIG Counter Button */}
             <div
               className={`
                 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all border-4 pointer-events-auto
                 ${remainingCount === 0 
                    ? 'bg-emerald-500 border-emerald-200 text-white scale-110' 
                    : 'bg-emerald-600 border-emerald-100 text-white'
                 }
               `}
               onClick={handleCounterClick}
             >
               {remainingCount === 0 ? (
                 <span className="text-3xl">✓</span>
               ) : (
                 <div className="flex flex-col items-center leading-none">
                    <span className="text-3xl font-bold font-mono">{remainingCount}</span>
                 </div>
               )}
             </div>

             {/* Next Button (Disabled if count not zero, unless forced) */}
             <button 
                onClick={handleNext} 
                className={`w-12 h-12 flex items-center justify-center text-2xl transition-colors hover:bg-slate-50 rounded-full pointer-events-auto ${remainingCount === 0 ? 'text-emerald-600' : 'text-slate-300'}`}
             >
               ➜
             </button>
          </div>
        </div>
        
        <p className="text-center text-[10px] text-slate-400 mt-2">اضغط في أي مكان للعد</p>
      </div>
    );
  }

  // 2. TASBIH MODE (Updated: Click Anywhere)
  if (mode === 'tasbih') {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] p-4 select-none">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#f8fafc] z-10 py-2">
          <button onClick={() => setMode('menu')} className="text-slate-500 font-bold px-2">← القائمة</button>
          <h2 className="font-bold text-emerald-800 text-lg">تسابيح - أذكار عظيمة</h2>
          <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-20 no-scrollbar">
           {TASBIH_FIXED_LIST.map((item, idx) => {
             const target = typeof item.count === 'number' ? item.count : 100;
             const current = tasbihCounts[idx] !== undefined ? tasbihCounts[idx] : target;
             const isDone = current === 0;

             return (
               <div 
                  key={idx} 
                  onClick={() => decrementTasbih(idx, target)}
                  className="flex bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm min-h-[8rem] cursor-pointer active:scale-[0.98] transition-transform group"
               >
                 
                 {/* Right Side: Text content */}
                 <div className="flex-1 p-4 flex flex-col justify-center items-start text-right group-hover:bg-slate-50 transition-colors">
                    <p className="font-amiri font-bold text-lg text-slate-800 leading-snug">{item.zekr}</p>
                    {item.description && (
                       <p className="text-xs text-emerald-600 mt-2 font-medium">{item.description}</p>
                    )}
                    <div className="mt-2 text-[10px] text-slate-400 flex gap-2">
                       <span className="bg-slate-50 px-2 py-0.5 rounded">العدد: {target}</span>
                    </div>
                 </div>

                 {/* Left Side: Counter Display */}
                 <div className={`
                      w-24 flex-none flex flex-col items-center justify-center relative transition-colors
                      ${isDone ? 'bg-emerald-700' : 'bg-emerald-500'}
                      text-white
                    `}
                 >
                    {/* The Big Number */}
                    <span className="text-4xl font-mono font-bold z-10 relative">{current}</span>
                    
                    {/* Optional: Faded background number for style */}
                    <span className="absolute text-6xl opacity-10 font-mono font-bold">{target}</span>

                    {/* Completion Check */}
                    {isDone && (
                      <div className="absolute inset-0 bg-emerald-700 flex items-center justify-center z-20">
                         <span className="text-4xl">✓</span>
                      </div>
                    )}

                    {/* Reset Button (Small, bottom-left) - Stops propagation */}
                    <div 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          resetTasbih(idx, target); 
                        }}
                        className="absolute bottom-2 left-2 p-2 text-emerald-200 hover:text-white z-30 cursor-pointer transition-colors"
                        title="إعادة العد"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                           <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                           <path d="M3 3v5h5" />
                        </svg>
                    </div>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  }

  // 3. MENU MODE (Grid Layout)
  return (
    <div className="p-4 pb-20">
      <div className="flex justify-between items-center mb-4">
         <h3 className="font-bold text-slate-800 text-lg">أقسام الأذكار</h3>
         <button onClick={handleRefresh} className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold active:bg-emerald-100 transition-colors">🔄 تحديث</button>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="ابحث عن دعاء أو ذكر..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-3 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm transition-all"
        />
        <span className="absolute right-3 top-3.5 text-slate-400 text-lg">🔍</span>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-3 text-slate-400 hover:text-red-500 text-xl font-bold px-2"
          >
            ✕
          </button>
        )}
      </div>
      
      {searchQuery ? (
        // Search Results View
        <div className="space-y-3">
          {searchResults.length === 0 ? (
            <div className="text-center py-10">
              <span className="text-4xl">🤔</span>
              <p className="text-slate-400 mt-2 font-bold">لا توجد نتائج مطابقة</p>
            </div>
          ) : (
            searchResults.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => handleSearchResultClick(searchResults, idx)}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-[0.99] hover:border-emerald-200 transition-all text-right"
              >
                <p className="font-amiri text-slate-800 line-clamp-2 leading-loose">{item.zekr}</p>
                <div className="flex justify-between items-center mt-2">
                   <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold">{item.category}</span>
                   {item.description && (
                     <span className="text-[10px] text-slate-400 truncate max-w-[60%]">{item.description}</span>
                   )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // Standard Grid View
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {GRID_ITEMS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleGridItemClick(item.label, item.isSpecial)}
              className={`
                p-3 rounded-xl font-bold text-sm text-center shadow-sm flex flex-col items-center justify-center gap-2 h-24
                transition-all active:scale-95 border
                ${item.isSpecial 
                   ? 'bg-amber-100 border-amber-200 text-amber-800' 
                   : 'bg-white border-slate-100 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                }
              `}
            >
              <span className="text-xl filter drop-shadow-sm">{item.icon}</span> 
              <span className="leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DhikrScreen;