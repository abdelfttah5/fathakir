
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { User, ActivityType, Reciter as LegacyReciter } from '../types';
import { Chapter, TafsirResource, Verse } from '../types/quran';
import { RECITER_SERVERS, RECITERS_LIST } from '../services/recitersData';
import {
  displayArabicName,
  getChapters,
  getTafsirForAyah,
  getTafsirResources,
  getVersesByPage,
  getVersesByChapter,
} from "../services/quranApi";

function sanitizeHtmlBasic(html: string) {
  return html || "";
}

interface QuranScreenProps {
  user: User;
  addLog: (type: ActivityType, summary: string, details?: string) => void;
  isDarkMode?: boolean;
}

const QuranScreen: React.FC<QuranScreenProps> = ({ user, addLog, isDarkMode = false }) => {
  const [activeTab, setActiveTab] = useState<'READ' | 'LISTEN'>('READ');
  
  // ==========================================
  // READ TAB STATE
  // ==========================================
  // Mode: 'PAGE' (Mushaf Pages 1-604) vs 'SCROLL' (Full Surah 1-114)
  const [viewMode, setViewMode] = useState<'PAGE' | 'SCROLL'>('SCROLL');
  
  const [currentPage, setCurrentPage] = useState(1); // For Page Mode
  const [currentSurahId, setCurrentSurahId] = useState(1); // For Scroll Mode

  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);

  // Indexes & Resources
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [tafsirs, setTafsirs] = useState<TafsirResource[]>([]);
  const [tafsirId, setTafsirId] = useState<number | null>(null);

  // Tafsir Modal
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsirTitle, setTafsirTitle] = useState("");
  const [tafsirHtml, setTafsirHtml] = useState("");

  // Auto Scroll
  const [autoPlay, setAutoPlay] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollAccumulator = useRef(0); 
  
  // Swipe Logic (Page Mode Only)
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null; 
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentPage(p => Math.min(604, p + 1));
    } else if (isRightSwipe) {
      setCurrentPage(p => Math.max(1, p - 1));
    }
  };

  // --- LOAD RESOURCES ---
  useEffect(() => {
    (async () => {
      try {
        const [chs, tfs] = await Promise.all([
          getChapters(),
          getTafsirResources(),
        ]);
        setChapters(chs);

        const arabic = tfs.filter((x) => (x.language_name || "").toLowerCase().includes("arab"));
        const pick = arabic[0] || tfs[0];
        setTafsirId(pick?.id ?? null);
        setTafsirs(tfs);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // --- FETCH CONTENT (Dual Mode) ---
  useEffect(() => {
    let active = true;
    const fetchContent = async () => {
      setLoading(true);
      setVerses([]); // Clear previous
      try {
        let v: Verse[] = [];
        
        if (viewMode === 'PAGE') {
          // Fetch by Mushaf Page
          v = await getVersesByPage(currentPage);
        } else {
          // Fetch by Surah
          v = await getVersesByChapter(currentSurahId);
        }

        if (active) {
          setVerses(v);
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            scrollAccumulator.current = 0;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchContent();
    return () => { active = false; };
  }, [viewMode, currentPage, currentSurahId]);

  // --- AUTO SCROLL LOOP (Scroll Mode Only) ---
  useEffect(() => {
    if (!autoPlay || viewMode !== 'SCROLL' || loading) return;

    const el = scrollContainerRef.current;
    if (!el) return;

    scrollAccumulator.current = el.scrollTop;

    let rafId: number;
    const step = () => {
      scrollAccumulator.current += (scrollSpeed * 0.5); 
      el.scrollTop = scrollAccumulator.current;
      
      if (Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1) {
        setAutoPlay(false);
      } else {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [autoPlay, viewMode, scrollSpeed, loading]);

  // --- NAVIGATION HELPERS ---
  function goToSurah(ch: Chapter) {
    setShowChapters(false);
    if (viewMode === 'SCROLL') {
      setCurrentSurahId(ch.id);
    } else {
      // In Page mode, go to the first page of that surah
      const startPage = ch.pages?.[0] ?? 1;
      setCurrentPage(startPage);
    }
  }

  // --- LOGGING ---
  const handleRecordReading = () => {
    const summary = viewMode === 'SCROLL' 
        ? `قرأ سورة ${currentChapterName}` 
        : `قرأ صفحة ${currentPage} من المصحف`;
    
    addLog(ActivityType.QURAN, summary);
  };

  // --- TAFSIR ---
  async function openTafsir(v: Verse) {
    if (!tafsirId) return;
    setTafsirOpen(true);
    setTafsirTitle(`التفسير (الآية ${v.verse_key})`);
    setTafsirHtml("...جاري التحميل");
    try {
      const html = await getTafsirForAyah(tafsirId, v.verse_key);
      setTafsirHtml(html || "لا يوجد تفسير متاح لهذه الآية.");
    } catch {
      setTafsirHtml("تعذر تحميل التفسير الآن.");
    }
  }

  // ==========================================
  // LISTEN TAB STATE (Blue Theme)
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRadioReciter, setSelectedRadioReciter] = useState<LegacyReciter | null>(null);
  const [playingSurahNum, setPlayingSurahNum] = useState<number | null>(null);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [radioAudioEl, setRadioAudioEl] = useState<HTMLAudioElement | null>(null);
  const [radioCurrentTime, setRadioCurrentTime] = useState(0);
  const [radioDuration, setRadioDuration] = useState(0);

  const playRadioAudio = (url: string, surahNum: number) => {
    if (radioAudioEl) {
      radioAudioEl.pause();
      radioAudioEl.src = "";
    }
    const newAudio = new Audio(url);
    newAudio.addEventListener('timeupdate', () => {
      setRadioCurrentTime(newAudio.currentTime);
      setRadioDuration(newAudio.duration || 0);
    });
    newAudio.addEventListener('ended', () => setIsRadioPlaying(false));
    newAudio.play().catch(e => console.error("Radio Play Error:", e));
    setRadioAudioEl(newAudio);
    setIsRadioPlaying(true);
    setPlayingSurahNum(surahNum);
  };

  const toggleRadioPlay = () => {
    if (!radioAudioEl) return;
    isRadioPlaying ? radioAudioEl.pause() : radioAudioEl.play();
    setIsRadioPlaying(!isRadioPlaying);
  };

  useEffect(() => {
    return () => { if (radioAudioEl) radioAudioEl.pause(); };
  }, [radioAudioEl]);

  const filteredReciters = React.useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return RECITERS_LIST;
    return RECITERS_LIST.filter(r => r.ar.includes(q) || r.en.toLowerCase().includes(q.toLowerCase()));
  }, [searchQuery]);

  const handleSelectRadioSurah = (surahNum: number) => {
    if (!selectedRadioReciter) return;
    const recitation = selectedRadioReciter.recitations[0];
    const [serverKey, path] = recitation.loc.split(':');
    const serverUrl = RECITER_SERVERS[serverKey];
    const paddedNum = String(surahNum).padStart(3, '0');
    const fullUrl = `${serverUrl}${path}/${paddedNum}.mp3`;
    playRadioAudio(fullUrl, surahNum);
    addLog(ActivityType.QURAN, `يستمع إلى ${selectedRadioReciter.ar} - سورة ${surahNum}`);
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // --- THEME ---
  const theme = {
    bg: isDarkMode ? 'bg-[#1a1a1a]' : 'bg-[#fdfcf5]', 
    text: isDarkMode ? 'text-[#e0e0e0]' : 'text-[#2d2d2d]',
    controlBg: isDarkMode ? 'bg-[#2a2a2a]' : 'bg-white',
    border: isDarkMode ? 'border-[#333]' : 'border-[#e6e6e6]',
    activeBtn: isDarkMode ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white',
    inactiveBtn: isDarkMode ? 'bg-[#333] text-gray-400' : 'bg-slate-100 text-slate-500',
  };

  const currentChapterObj = chapters.find(c => c.id === (viewMode === 'SCROLL' ? currentSurahId : 0));
  const currentChapterName = currentChapterObj ? currentChapterObj.name_arabic : `صفحة ${currentPage}`;

  return (
    <div className={`flex flex-col h-full transition-colors duration-500 ${theme.bg}`}>
      
      {/* MAIN TABS */}
      <div className={`flex p-2 gap-2 rounded-xl m-2 mb-0 shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100/50'}`}>
        <button 
          onClick={() => setActiveTab('READ')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'READ' ? (isDarkMode ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-50 text-emerald-700 shadow-sm') : 'text-slate-500'}`}
        >
          📖 المصحف
        </button>
        <button 
          onClick={() => setActiveTab('LISTEN')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'LISTEN' ? (isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-50 text-blue-700 shadow-sm') : 'text-slate-500'}`}
        >
          🎧 إذاعة القراء
        </button>
      </div>

      {activeTab === 'READ' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Controls Bar */}
          <div className={`sticky top-0 z-20 ${theme.controlBg} border-b ${theme.border} shadow-sm px-3 py-3`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 max-w-3xl mx-auto">
               
               <div className="flex items-center justify-between w-full">
                   <div className="flex items-center gap-2">
                      <div className={`flex rounded-lg overflow-hidden border ${theme.border}`}>
                         <button 
                           onClick={() => { setViewMode('PAGE'); setAutoPlay(false); }}
                           className={`px-3 py-1 text-xs font-bold ${viewMode === 'PAGE' ? theme.activeBtn : theme.controlBg + ' ' + theme.text}`}
                           title="وضع التقليب (صفحات)"
                         >
                           📄
                         </button>
                         <button 
                           onClick={() => { setViewMode('SCROLL'); setAutoPlay(false); }}
                           className={`px-3 py-1 text-xs font-bold ${viewMode === 'SCROLL' ? theme.activeBtn : theme.controlBg + ' ' + theme.text}`}
                           title="وضع التمرير (سور)"
                         >
                           📜
                         </button>
                      </div>

                      {viewMode === 'SCROLL' && (
                         <div className="flex items-center gap-2 animate-fade-in">
                            <button
                                onClick={() => setAutoPlay(!autoPlay)}
                                className={`text-xs font-bold w-20 py-1.5 rounded-lg border transition-all ${autoPlay 
                                    ? (isDarkMode ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-red-50 text-red-600 border-red-200')
                                    : (isDarkMode ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-600 border-emerald-200')
                                }`}
                              >
                                {autoPlay ? "⏸ إيقاف" : "▶ تلقائي"}
                            </button>
                         </div>
                      )}
                      
                      {/* --- RECORD BUTTON --- */}
                      <button 
                         onClick={handleRecordReading}
                         className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 active:scale-95 transition-all ${isDarkMode ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                      >
                         <span>✅</span>
                         <span>سجل الورد</span>
                      </button>

                   </div>
                   
                   <div className="flex items-center gap-2">
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-lg truncate max-w-[100px] ${isDarkMode ? 'bg-[#333] text-emerald-400' : 'bg-emerald-50 text-emerald-800'}`}>
                        {viewMode === 'SCROLL' ? currentChapterName : `ص ${currentPage}`}
                      </div>
                      <button onClick={() => setShowChapters(true)} className={`px-2 py-1.5 rounded-lg text-xs font-bold ${theme.inactiveBtn}`}>
                        ☰
                      </button>
                   </div>
               </div>
            </div>
          </div>

          {/* Content Area - FIXED LAYOUT FOR SCROLLING */}
          <div className="flex-1 relative w-full h-full">
            <div
              ref={scrollContainerRef}
              className={`absolute inset-0 pb-32 ${theme.bg} ${viewMode === 'SCROLL' ? 'overflow-y-scroll' : 'overflow-hidden touch-pan-y'}`}
              style={{ scrollbarGutter: "stable" }}
              onTouchStart={viewMode === 'PAGE' ? onTouchStart : undefined}
              onTouchMove={viewMode === 'PAGE' ? onTouchMove : undefined}
              onTouchEnd={viewMode === 'PAGE' ? onTouchEnd : undefined}
            >
              <div className="max-w-4xl mx-auto px-4 py-8 min-h-full flex flex-col justify-center">
                {loading ? (
                  <div className="p-20 text-center flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                    <span className={`text-sm ${theme.text}`}>
                      {viewMode === 'SCROLL' ? 'جاري تحميل السورة...' : 'جاري تحميل الصفحة...'}
                    </span>
                  </div>
                ) : (
                  <div className="relative animate-fade-in">
                     
                     {viewMode === 'PAGE' && (
                        <div className={`border-2 ${isDarkMode ? 'border-[#333]' : 'border-[#e0e0e0]'} p-1 rounded-sm mb-4 shadow-sm`}>
                            <div className={`border ${isDarkMode ? 'border-[#222]' : 'border-[#ebebeb]'} p-4 md:p-8 min-h-[60vh] flex items-center`}>
                              <div className={`text-justify leading-[3.5] text-2xl md:text-3xl font-amiri w-full ${theme.text}`} dir="rtl">
                                  {verses.map((v) => (
                                  <span 
                                      key={v.id}
                                      onClick={() => openTafsir(v)}
                                      className={`inline cursor-pointer transition-colors duration-200 px-1 rounded hover:bg-emerald-500/10`}
                                  >
                                      {/* FALLBACK to Simple Uthmani if standard is missing */}
                                      {v.text_uthmani || v.text_uthmani_simple}
                                      <span className={`inline-flex items-center justify-center min-w-[30px] h-[30px] mx-1 align-middle rounded-full text-[0.4em] font-sans border opacity-70 ${isDarkMode ? 'bg-[#333] border-[#555] text-gray-400' : 'bg-[#f0f0f0] border-[#ddd] text-slate-500'}`}>
                                      {v.verse_number}
                                      </span>
                                  </span>
                                  ))}
                              </div>
                            </div>
                        </div>
                     )}

                     {viewMode === 'SCROLL' && (
                         <div className="space-y-6">
                            <div className="text-center pb-6 border-b border-dashed border-gray-300/30 mb-6">
                               <h2 className={`font-amiri font-bold text-3xl ${theme.text}`}>
                                 {currentChapterName}
                               </h2>
                               <p className="text-xs opacity-50 mt-2">بداية السورة</p>
                            </div>

                            {verses.map((v) => (
                                <div key={v.id} className={`rounded-3xl p-6 text-center shadow-sm border ${isDarkMode ? 'bg-[#252525] border-[#333]' : 'bg-white/80 border-slate-100'}`}>
                                    {/* FALLBACK to Simple Uthmani if standard is missing */}
                                    <p className={`font-amiri text-2xl md:text-3xl leading-loose mb-6 ${theme.text}`}>
                                        {v.text_uthmani || v.text_uthmani_simple}
                                    </p>
                                    <div className="flex items-center justify-center gap-3">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${isDarkMode ? 'bg-[#333] text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                                            الآية {v.verse_number}
                                        </div>
                                        <button 
                                            onClick={() => openTafsir(v)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${isDarkMode ? 'bg-[#333] text-gray-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            تفسير
                                        </button>
                                    </div>
                                </div>
                            ))}
                            
                            <div className="text-center py-10 opacity-70">
                                <p className={`text-sm mb-4 ${theme.text}`}>-- نهاية السورة --</p>
                                <div className="flex flex-col gap-3 justify-center items-center">
                                    <button 
                                        onClick={handleRecordReading}
                                        className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${isDarkMode ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}
                                    >
                                        <span>✅</span> سجل أنك أتممت القراءة
                                    </button>
                                    {currentSurahId < 114 && (
                                    <button 
                                        onClick={() => setCurrentSurahId(s => s + 1)}
                                        className={`px-6 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}
                                    >
                                        الانتقال للسورة التالية &larr;
                                    </button>
                                    )}
                                </div>
                            </div>
                         </div>
                     )}
                     
                     {viewMode === 'PAGE' && (
                       <div className="flex justify-between items-center mt-4 px-4 opacity-50 hover:opacity-100 transition-opacity">
                          <button onClick={() => setCurrentPage(p => Math.min(604, p + 1))} className={`px-4 py-2 rounded-full text-xs font-bold ${theme.inactiveBtn}`}>
                            الصفحة التالية &larr;
                          </button>
                          <p className={`text-xs ${theme.text}`}>نهاية الصفحة {currentPage}</p>
                          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={`px-4 py-2 rounded-full text-xs font-bold ${theme.inactiveBtn}`}>
                            &rarr; الصفحة السابقة
                          </button>
                       </div>
                     )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'LISTEN' && (
        <div className={`flex-1 flex flex-col p-4 overflow-hidden relative ${theme.bg}`}>
          
          <div className="flex items-center justify-between mb-4">
             <h3 className={`font-bold ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>إذاعة القراء</h3>
          </div>

          {!selectedRadioReciter ? (
            <>
              <div className="relative mb-4">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن قارئ..."
                  className={`w-full p-3 rounded-xl border outline-none transition-all ${isDarkMode ? 'bg-[#243042] border-blue-900 text-white placeholder-blue-400 focus:border-blue-500' : 'bg-white border-blue-100 text-slate-800 focus:border-blue-300 shadow-sm'}`}
                />
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar pb-24 grid grid-cols-2 gap-3">
                {filteredReciters.map((reciter, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setSelectedRadioReciter(reciter)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-95 ${isDarkMode ? 'bg-[#243042] border-blue-900 hover:border-blue-500 text-blue-100' : 'bg-white border-blue-100 hover:border-blue-300 shadow-sm hover:shadow-md'}`}
                  >
                    <p className="font-bold text-sm mb-1">{reciter.ar}</p>
                    <p className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-slate-500'}`}>{reciter.en}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
               <div className={`p-4 rounded-xl mb-4 border flex items-center justify-between ${isDarkMode ? 'bg-[#243042] border-blue-900' : 'bg-white border-blue-100 shadow-sm'}`}>
                  <div>
                    <h3 className={`font-bold ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>{selectedRadioReciter.ar}</h3>
                    <button onClick={() => setSelectedRadioReciter(null)} className={`text-xs mt-1 underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>تغيير القارئ</button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto no-scrollbar pb-40 space-y-1">
                 {Array.from({ length: 114 }, (_, i) => i + 1).map(sNum => (
                   <div 
                     key={sNum}
                     onClick={() => handleSelectRadioSurah(sNum)}
                     className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${playingSurahNum === sNum ? (isDarkMode ? 'bg-blue-900/60 border border-blue-700' : 'bg-blue-100 border border-blue-200') : (isDarkMode ? 'hover:bg-[#243042]' : 'bg-white/60 hover:bg-white border border-transparent')}`}
                   >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{sNum}</span>
                        <span className={`font-bold font-amiri ${isDarkMode ? 'text-blue-100' : 'text-slate-700'}`}>سورة {sNum}</span>
                      </div>
                      {playingSurahNum === sNum && isRadioPlaying && <span className="text-blue-500 text-xs animate-pulse">▶</span>}
                   </div>
                 ))}
               </div>
            </div>
          )}

          {playingSurahNum && selectedRadioReciter && (
            <div className={`absolute bottom-20 left-0 right-0 p-4 mx-2 rounded-2xl shadow-2xl border backdrop-blur-md ${isDarkMode ? 'bg-[#1a2333]/95 border-blue-900' : 'bg-white/95 border-blue-100'}`}>
               <div className="flex items-center justify-between mb-2">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isDarkMode ? 'text-blue-100' : 'text-slate-800'}`}>
                      سورة {playingSurahNum}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-slate-500'}`}>{selectedRadioReciter.ar}</p>
                  </div>
                  <button onClick={toggleRadioPlay} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${isRadioPlaying ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}`}>
                    {isRadioPlaying ? '⏸' : '▶'}
                  </button>
               </div>
               <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-slate-100'}`}>
                  <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(radioCurrentTime / (radioDuration || 1)) * 100}%` }}></div>
               </div>
               <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-mono">
                  <span>{formatTime(radioCurrentTime)}</span>
                  <span>{formatTime(radioDuration)}</span>
               </div>
            </div>
          )}
        </div>
      )}

      {showChapters && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowChapters(false)}>
          <div className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] ${theme.controlBg}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.border}`}>
              <div className={`font-bold flex items-center gap-2 ${theme.text}`}><span>📜</span> فهرس السور</div>
              <button onClick={() => setShowChapters(false)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'bg-[#333] hover:bg-[#444] text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}>
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-scroll p-2 space-y-1">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => goToSurah(ch)}
                  className={`w-full text-right px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${isDarkMode ? 'border-[#333] hover:bg-[#333] text-gray-200' : 'border-slate-100 hover:border-emerald-300 bg-white text-slate-700'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isDarkMode ? 'bg-[#222] text-emerald-500' : 'bg-slate-50 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700'}`}>{ch.id}</div>
                    <div className="font-bold font-amiri text-lg">{ch.name_arabic}</div>
                  </div>
                  <div className={`text-[10px] px-2 py-1 rounded ${isDarkMode ? 'bg-[#222] text-gray-500' : 'bg-slate-50 text-slate-400'}`}>
                    {ch.pages[0]} ص
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tafsirOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setTafsirOpen(false)}>
          <div className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] ${theme.controlBg}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.border}`}>
              <div className={`font-bold text-sm truncate max-w-[80%] ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>{tafsirTitle}</div>
              <button onClick={() => setTafsirOpen(false)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'bg-[#333] hover:bg-[#444] text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}>
                ✕
              </button>
            </div>

            <div
              className={`flex-1 overflow-y-scroll p-6 text-justify leading-9 font-amiri text-lg ${theme.text}`}
              style={{ scrollbarGutter: "stable" }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtmlBasic(tafsirHtml) }}
            />
          </div>
        </div>
      )}

    </div>
  );
}

export default QuranScreen;
