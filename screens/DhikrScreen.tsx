
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { User, ActivityType, AzkarJSON, ZekrItem } from '../types';
import { TASBIH_FIXED_LIST } from '../constants';
import { fetchAllAzkarDB, clearAzkarCache } from '../services/api';

interface DhikrScreenProps {
  user: User;
  addLog: (type: ActivityType, summary: string, details?: string) => void;
  isDarkMode?: boolean;
}

// Updated Grid with Distinct Colors for each item
// We use a helper function to adapt these to Dark Mode inside the component
const GRID_ITEMS = [
  { label: 'أذكار الصباح', icon: '☀️', style: 'bg-orange-50 text-orange-600 border-orange-100' },
  { label: 'أذكار المساء', icon: '🌙', style: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  { label: 'تسابيح', icon: '📿', isSpecial: true, style: 'bg-amber-100 text-amber-800 border-amber-200' },
  { label: 'أذكار بعد الصلاة', icon: '🤲', style: 'bg-blue-50 text-blue-600 border-blue-100' },
  { label: 'أذكار الاستيقاظ', icon: '🌅', style: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
  { label: 'أذكار النوم', icon: '🛌', style: 'bg-slate-50 text-slate-600 border-slate-200' },
  { label: 'أذكار الصلاة', icon: '🕌', style: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  { label: 'أذكار الآذان', icon: '📢', style: 'bg-rose-50 text-rose-600 border-rose-100' },
  { label: 'أذكار المسجد', icon: '🕋', style: 'bg-teal-50 text-teal-600 border-teal-100' },
  { label: 'أذكار الوضوء', icon: '💧', style: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  { label: 'أذكار المنزل', icon: '🏠', style: 'bg-green-50 text-green-600 border-green-100' },
  { label: 'أذكار الخلاء', icon: '🚽', style: 'bg-gray-50 text-gray-500 border-gray-200' },
  { label: 'أذكار الطعام', icon: '🍽️', style: 'bg-lime-50 text-lime-600 border-lime-100' },
  { label: 'أذكار الحج والعمرة', icon: '🕋', style: 'bg-stone-50 text-stone-600 border-stone-200' },
  { label: 'دعاء ختم القرآن الكريم', icon: '📖', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'الأدعية القرآنية', icon: '📜', style: 'bg-amber-50 text-amber-600 border-amber-100' },
  { label: 'أدعية الأنبياء', icon: '✨', style: 'bg-purple-50 text-purple-600 border-purple-100' },
  { label: 'الرقية الشرعية', icon: '🛡️', style: 'bg-red-50 text-red-600 border-red-100' },
  { label: 'أذكار متفرقة', icon: '🌸', style: 'bg-pink-50 text-pink-600 border-pink-100' },
  { label: 'جوامع الدعاء', icon: '🤲', style: 'bg-violet-50 text-violet-600 border-violet-100' },
  { label: 'فضل الدعاء', icon: '💎', style: 'bg-sky-50 text-sky-600 border-sky-100' },
  { label: 'فضل الذكر', icon: '❤️', style: 'bg-rose-100 text-rose-700 border-rose-200' },
  { label: 'فضل القرآن', icon: '⭐', style: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { label: 'فضل السور', icon: '🌟', style: 'bg-orange-100 text-orange-700 border-orange-200' },
  { label: 'أسماء الله الحسنى', icon: 'ﷻ', style: 'bg-teal-100 text-teal-800 border-teal-200' },
  { label: 'أدعية للميت', icon: '⚰️', style: 'bg-gray-100 text-gray-700 border-gray-300' },
];

const DhikrScreen: React.FC<DhikrScreenProps> = ({ user, addLog, isDarkMode = false }) => {
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
    let normalized = text.replace(/[\u064B-\u065F\u0670]/g, '');
    normalized = normalized.replace(/[أإآ]/g, 'ا');
    normalized = normalized.replace(/ة/g, 'ه');
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
      if (navigator.vibrate) navigator.vibrate(50);
      const newCount = remainingCount - 1;
      setRemainingCount(newCount);
      
      if (newCount === 0) {
         setIsCompleted(true);
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
    setTasbihCounts(prev => ({ ...prev, [index]: startCount }));
  };

  // --- UI RENDERERS ---

  const theme = {
    bg: isDarkMode ? 'bg-[#1a1a1a]' : 'bg-transparent', // App wrapper handles main bg
    card: isDarkMode ? 'bg-[#2a2a2a] border-[#333]' : 'bg-white border-slate-100',
    text: isDarkMode ? 'text-gray-100' : 'text-slate-800',
    subText: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    inputBg: isDarkMode ? 'bg-[#333] border-[#444] text-white placeholder-gray-500' : 'bg-white border-slate-200 text-slate-800',
    highlight: isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50',
    actionBtn: isDarkMode ? 'bg-[#333] hover:bg-[#444] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500',
  };

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
      <div className={`flex flex-col justify-center items-center h-[60vh] gap-4 p-6 text-center ${theme.subText}`}>
        <div className="text-4xl">⚠️</div>
        <p className={`font-bold ${theme.text}`}>تعذر تحميل البيانات</p>
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
          <button onClick={() => setMode('menu')} className={`px-2 py-1 rounded-lg text-sm font-bold ${theme.actionBtn}`}>خروج</button>
          <span className={`font-bold text-sm truncate max-w-[150px] ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>{activeSession.title}</span>
          <span className={`text-xs px-2 py-1 rounded-lg font-bold ${isDarkMode ? 'bg-[#333] text-gray-300' : 'bg-slate-100 text-slate-500'}`}>{currentIndex + 1} / {activeSession.items.length}</span>
        </div>

        {/* Progress Bar */}
        <div className={`w-full h-2 rounded-full mb-6 overflow-hidden ${isDarkMode ? 'bg-[#333]' : 'bg-slate-100'}`}>
          <div className="bg-emerald-500 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Zekr Card */}
        <div 
           onClick={handleCounterClick}
           className={`flex-1 rounded-3xl p-6 shadow-sm border flex flex-col relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform ${theme.card}`}
        >
          <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
             <p className={`text-2xl md:text-3xl leading-loose font-amiri text-center dir-rtl ${theme.text}`}>
               {currentZekr.zekr}
             </p>
             
             {currentZekr.description && (
                <p className={`mt-6 text-sm text-center border-t pt-4 font-bold p-2 rounded-xl ${isDarkMode ? 'border-[#333] bg-[#222] text-emerald-400' : 'border-slate-50 bg-emerald-50/50 text-emerald-600'}`}>{currentZekr.description}</p>
             )}

             {currentZekr.reference && (
                <p className={`mt-2 text-[10px] text-center ${theme.subText}`}>{currentZekr.reference}</p>
             )}
          </div>
          
          {/* Floating Action Area / Counter */}
          <div className={`absolute bottom-0 left-0 right-0 backdrop-blur-sm p-4 border-t flex items-center justify-between pointer-events-none ${isDarkMode ? 'bg-[#222]/90 border-[#333]' : 'bg-white/95 border-slate-100'}`}>
             {/* Buttons */}
             <button 
                onClick={handlePrev} 
                disabled={currentIndex === 0}
                className={`w-12 h-12 flex items-center justify-center text-2xl rounded-full pointer-events-auto transition-colors ${isDarkMode ? 'text-gray-500 hover:bg-[#333]' : 'text-slate-400 hover:bg-slate-50'}`}
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

             {/* Next Button */}
             <button 
                onClick={handleNext} 
                className={`w-12 h-12 flex items-center justify-center text-2xl transition-colors rounded-full pointer-events-auto ${remainingCount === 0 ? 'text-emerald-500' : isDarkMode ? 'text-gray-600 hover:bg-[#333]' : 'text-slate-300 hover:bg-slate-50'}`}
             >
               ➜
             </button>
          </div>
        </div>
        
        <p className={`text-center text-[10px] mt-2 ${theme.subText}`}>اضغط في أي مكان للعد</p>
      </div>
    );
  }

  // 2. TASBIH MODE
  if (mode === 'tasbih') {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] p-4 select-none">
        <div className={`flex items-center justify-between mb-4 sticky top-0 z-10 py-2 ${isDarkMode ? 'bg-slate-900' : 'bg-[#f8fafc]'}`}>
          <button onClick={() => setMode('menu')} className={`font-bold px-2 ${theme.subText}`}>← القائمة</button>
          <h2 className={`font-bold text-lg ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>تسابيح - أذكار عظيمة</h2>
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
                  className={`flex rounded-xl border overflow-hidden shadow-sm min-h-[8rem] cursor-pointer active:scale-[0.98] transition-transform group ${theme.card}`}
               >
                 
                 <div className={`flex-1 p-4 flex flex-col justify-center items-start text-right transition-colors ${isDarkMode ? 'group-hover:bg-[#252525]' : 'group-hover:bg-slate-50'}`}>
                    <p className={`font-amiri font-bold text-lg leading-snug ${theme.text}`}>{item.zekr}</p>
                    {item.description && (
                       <p className="text-xs text-emerald-600 mt-2 font-medium">{item.description}</p>
                    )}
                    <div className="mt-2 text-[10px] flex gap-2">
                       <span className={`px-2 py-0.5 rounded ${isDarkMode ? 'bg-[#333] text-gray-400' : 'bg-slate-50 text-slate-400'}`}>العدد: {target}</span>
                    </div>
                 </div>

                 <div className={`
                      w-24 flex-none flex flex-col items-center justify-center relative transition-colors
                      ${isDone ? 'bg-emerald-700' : 'bg-emerald-500'}
                      text-white
                    `}
                 >
                    <span className="text-4xl font-mono font-bold z-10 relative">{current}</span>
                    <span className="absolute text-6xl opacity-10 font-mono font-bold">{target}</span>
                    {isDone && (
                      <div className="absolute inset-0 bg-emerald-700 flex items-center justify-center z-20">
                         <span className="text-4xl">✓</span>
                      </div>
                    )}
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
         <h3 className={`font-bold text-lg ${theme.text}`}>أقسام الأذكار</h3>
         <button onClick={handleRefresh} className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold active:bg-emerald-100 transition-colors">🔄 تحديث</button>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          placeholder="ابحث عن دعاء أو ذكر..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full p-3 pr-10 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm transition-all ${theme.inputBg}`}
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
        <div className="space-y-3">
          {searchResults.length === 0 ? (
            <div className="text-center py-10">
              <span className="text-4xl">🤔</span>
              <p className={`mt-2 font-bold ${theme.subText}`}>لا توجد نتائج مطابقة</p>
            </div>
          ) : (
            searchResults.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => handleSearchResultClick(searchResults, idx)}
                className={`p-4 rounded-xl border shadow-sm cursor-pointer active:scale-[0.99] hover:border-emerald-200 transition-all text-right ${theme.card}`}
              >
                <p className={`font-amiri line-clamp-2 leading-loose ${theme.text}`}>{item.zekr}</p>
                <div className="flex justify-between items-center mt-2">
                   <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold">{item.category}</span>
                   {item.description && (
                     <span className={`text-[10px] truncate max-w-[60%] ${theme.subText}`}>{item.description}</span>
                   )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {GRID_ITEMS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleGridItemClick(item.label, item.isSpecial)}
              className={`
                p-3 rounded-xl font-bold text-sm text-center shadow-sm flex flex-col items-center justify-center gap-2 h-28
                transition-all active:scale-95 border
                ${isDarkMode ? 'bg-[#2a2a2a] border-[#333] text-gray-200' : item.style}
              `}
            >
              <span className="text-3xl filter drop-shadow-sm">{item.icon}</span> 
              <span className="leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DhikrScreen;
