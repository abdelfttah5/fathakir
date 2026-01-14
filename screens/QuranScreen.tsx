
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { User, ActivityType, Reciter } from '../types';
import { Chapter, TafsirResource, Verse } from '../types/quran';
import {
  getChapters,
  getTafsirForAyah,
  getTafsirResources,
  getVersesByPage,
  getVersesByChapter
} from "../services/quranApi";
import { RECITERS_LIST, RECITER_SERVERS, QIRAAT_NAMES } from '../services/recitersData';

function sanitizeHtmlBasic(html: string) {
  return html || "";
}

interface QuranScreenProps {
  user: User;
  addLog: (type: ActivityType, summary: string, details?: string) => void;
  isDarkMode?: boolean;
}

const QuranScreen: React.FC<QuranScreenProps> = ({ user, addLog, isDarkMode = false }) => {
  // TABS: 'READ' (Text), 'AUDIO_ONLY' (Listen) - REMOVED SYNC
  const [activeTab, setActiveTab] = useState<'READ' | 'AUDIO_ONLY'>('READ');
  
  // ==========================================
  // READ TAB STATE
  // ==========================================
  const [viewMode, setViewMode] = useState<'PAGE' | 'SCROLL'>('SCROLL');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSurahId, setCurrentSurahId] = useState(1);

  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [tafsirs, setTafsirs] = useState<TafsirResource[]>([]);
  const [tafsirId, setTafsirId] = useState<number | null>(null);

  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsirTitle, setTafsirTitle] = useState("");
  const [tafsirHtml, setTafsirHtml] = useState("");

  const [autoPlay, setAutoPlay] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollAccumulator = useRef(0); 
  
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipeDistance = 50;

  // --- READ TAB EFFECTS ---
  const onTouchStart = (e: React.TouchEvent) => { touchEnd.current = null; touchStart.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEnd.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > minSwipeDistance) setCurrentPage(p => Math.min(604, p + 1));
    else if (distance < -minSwipeDistance) setCurrentPage(p => Math.max(1, p - 1));
  };

  useEffect(() => {
    (async () => {
      try {
        const [chs, tfs] = await Promise.all([getChapters(), getTafsirResources()]);
        setChapters(chs);
        const arabic = tfs.filter((x) => (x.language_name || "").toLowerCase().includes("arab"));
        const pick = arabic[0] || tfs[0];
        setTafsirId(pick?.id ?? null);
        setTafsirs(tfs);
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    const fetchContent = async () => {
      if (activeTab !== 'READ') return; // Only fetch text if in Read mode
      setLoading(true);
      setVerses([]);
      try {
        let v: Verse[] = [];
        if (viewMode === 'PAGE') v = await getVersesByPage(currentPage);
        else v = await getVersesByChapter(currentSurahId);
        
        if (active) {
          setVerses(v);
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            scrollAccumulator.current = 0;
          }
        }
      } catch (err) { console.error(err); } 
      finally { if (active) setLoading(false); }
    };
    fetchContent();
    return () => { active = false; };
  }, [viewMode, currentPage, currentSurahId, activeTab]);

  useEffect(() => {
    if (!autoPlay || viewMode !== 'SCROLL' || loading || activeTab !== 'READ') return;
    const el = scrollContainerRef.current;
    if (!el) return;
    scrollAccumulator.current = el.scrollTop;
    let rafId: number;
    const step = () => {
      scrollAccumulator.current += (scrollSpeed * 0.5); 
      el.scrollTop = scrollAccumulator.current;
      if (Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1) setAutoPlay(false);
      else rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [autoPlay, viewMode, scrollSpeed, loading, activeTab]);

  function goToSurah(ch: Chapter) {
    setShowChapters(false);
    if (viewMode === 'SCROLL') setCurrentSurahId(ch.id);
    else setCurrentPage(ch.pages?.[0] ?? 1);
  }

  const handleRecordReading = () => {
    addLog(ActivityType.QURAN, viewMode === 'SCROLL' ? `قرأ سورة ${currentChapterName}` : `قرأ صفحة ${currentPage} من المصحف`);
  };

  async function openTafsir(v: Verse) {
    if (!tafsirId) return;
    setTafsirOpen(true);
    setTafsirTitle(`التفسير (الآية ${v.verse_key})`);
    setTafsirHtml("...جاري التحميل");
    try {
      const html = await getTafsirForAyah(tafsirId, v.verse_key);
      setTafsirHtml(html || "لا يوجد تفسير متاح لهذه الآية.");
    } catch { setTafsirHtml("تعذر تحميل التفسير الآن."); }
  }

  // ==========================================
  // AUDIO ONLY STATE
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);
  const [selectedRecitationIndex, setSelectedRecitationIndex] = useState<number>(0);
  
  // Audio State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [radioCurrentTime, setRadioCurrentTime] = useState(0);
  const [radioDuration, setRadioDuration] = useState(0);
  const [playingSurahNum, setPlayingSurahNum] = useState<number | null>(null);

  // Clean up
  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  const playRadioAudio = (url: string, surahNum: number) => {
    // 1. Force Stop Old
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = ""; // Detach
    }

    // 2. Create New
    const newAudio = new Audio();
    newAudio.src = url;
    audioRef.current = newAudio;
    
    setRadioCurrentTime(0);
    setRadioDuration(0);
    setPlayingSurahNum(surahNum);
    setBuffering(true);

    newAudio.onloadedmetadata = () => setRadioDuration(newAudio.duration);
    newAudio.ontimeupdate = () => setRadioCurrentTime(newAudio.currentTime);
    newAudio.onended = () => { setIsRadioPlaying(false); setBuffering(false); };
    
    // Buffering States
    newAudio.onwaiting = () => setBuffering(true);
    newAudio.onplaying = () => { setIsRadioPlaying(true); setBuffering(false); };
    newAudio.oncanplay = () => setBuffering(false);

    newAudio.onerror = (e) => {
        console.error("Audio Load Error", e, url);
        setIsRadioPlaying(false);
        setBuffering(false);
        alert("تعذر تحميل ملف الصوت لهذا القارئ.");
    };

    const playPromise = newAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        setIsRadioPlaying(true);
      }).catch(error => {
        console.error("Play prevented:", error);
        setIsRadioPlaying(false);
        setBuffering(false);
      });
    }
  };

  const toggleRadioPlay = () => {
    if (!audioRef.current) return;
    if (isRadioPlaying) {
      audioRef.current.pause();
      setIsRadioPlaying(false);
    } else {
      audioRef.current.play();
      setIsRadioPlaying(true);
    }
  };

  const seekAudio = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && radioDuration) {
       const rect = e.currentTarget.getBoundingClientRect();
       const percent = (e.clientX - rect.left) / rect.width;
       audioRef.current.currentTime = percent * radioDuration;
    }
  };

  const handleSelectRadioSurah = async (surahNum: number) => {
    if (!selectedReciter) return;
    
    setBuffering(false);

    try {
        const recitation = selectedReciter.recitations[selectedRecitationIndex];
        const [serverKey, path] = recitation.loc.split(':');
        const baseUrl = RECITER_SERVERS[serverKey];
        
        if (baseUrl && path) {
            const surahStr = String(surahNum).padStart(3, '0');
            const audioUrl = `${baseUrl}${path}/${surahStr}.mp3`;
            
            playRadioAudio(audioUrl, surahNum);
            
            const reciterName = selectedReciter.ar || selectedReciter.en;
            addLog(ActivityType.QURAN, `يستمع إلى ${reciterName} - سورة ${surahNum}`);
        } else {
            alert("بيانات القارئ غير مكتملة.");
        }
    } catch(e) {
        console.error("Failed to load audio", e);
        alert("تعذر تشغيل الصوت.");
    }
  };

  // --- FILTERING RECITERS ---
  const filteredReciters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return searchQuery ? RECITERS_LIST.filter(r => 
        (r.ar.toLowerCase().includes(q)) || 
        (r.en.toLowerCase().includes(q))
    ) : RECITERS_LIST;
  }, [searchQuery]);


  // --- THEME ---
  const theme = {
    bg: isDarkMode ? 'bg-[#1a1a1a]' : 'bg-[#fdfcf5]', 
    text: isDarkMode ? 'text-[#e0e0e0]' : 'text-[#2d2d2d]',
    controlBg: isDarkMode ? 'bg-[#2a2a2a]' : 'bg-white',
    border: isDarkMode ? 'border-[#333]' : 'border-[#e6e6e6]',
    activeBtn: isDarkMode ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white',
    inactiveBtn: isDarkMode ? 'bg-[#333] text-gray-400' : 'bg-slate-100 text-slate-500',
    inputBg: isDarkMode ? 'bg-[#333] border-[#444] text-white placeholder-gray-500' : 'bg-white border-slate-200 text-slate-800',
  };

  const currentChapterObj = chapters.find(c => c.id === (viewMode === 'SCROLL' ? currentSurahId : 0));
  const currentChapterName = currentChapterObj ? currentChapterObj.name_arabic : `صفحة ${currentPage}`;

  return (
    <div className={`flex flex-col h-full transition-colors duration-500 ${theme.bg}`}>
      
      {/* TAB NAVIGATION */}
      <div className={`flex p-2 gap-2 rounded-xl m-2 mb-0 shrink-0 overflow-x-auto ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100/50'}`}>
        <button 
          onClick={() => setActiveTab('READ')} 
          className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all border-b-2 ${activeTab === 'READ' ? (isDarkMode ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500' : 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm') : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}
        >
          📖 المصحف الشريف
        </button>
        
        <button 
          onClick={() => setActiveTab('AUDIO_ONLY')} 
          className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all border-b-2 ${activeTab === 'AUDIO_ONLY' ? (isDarkMode ? 'bg-blue-900/40 text-blue-300 border-blue-500' : 'bg-blue-50 text-blue-700 border-blue-500 shadow-sm') : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}
        >
          🔊 استمع
        </button>
      </div>

      {/* =======================
          TAB 1: READ (اقرأ)
         ======================= */}
      {activeTab === 'READ' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative animate-fade-in">
          <div className={`sticky top-0 z-20 ${theme.controlBg} border-b ${theme.border} shadow-sm px-3 py-3`}>
            <div className="flex items-center justify-between gap-2">
                <div className={`flex rounded-lg overflow-hidden border ${theme.border}`}>
                  <button onClick={() => { setViewMode('PAGE'); setAutoPlay(false); }} className={`px-3 py-1 text-xs font-bold ${viewMode === 'PAGE' ? theme.activeBtn : theme.controlBg + ' ' + theme.text}`}>📄</button>
                  <button onClick={() => { setViewMode('SCROLL'); setAutoPlay(false); }} className={`px-3 py-1 text-xs font-bold ${viewMode === 'SCROLL' ? theme.activeBtn : theme.controlBg + ' ' + theme.text}`}>📜</button>
                </div>
                {viewMode === 'SCROLL' && (
                  <div className="flex items-center gap-2">
                      <button onClick={() => setAutoPlay(!autoPlay)} className={`text-xs font-bold w-20 py-1.5 rounded-lg border ${autoPlay ? 'text-red-500 border-red-200' : 'text-emerald-600 border-emerald-200'}`}>{autoPlay ? "⏸ إيقاف" : "▶ تلقائي"}</button>
                      <button onClick={() => setScrollSpeed(p => p>=3?0.5:p+0.5)} className={`text-xs font-bold w-8 py-1.5 rounded-lg border ${theme.inactiveBtn}`}>{scrollSpeed}x</button>
                  </div>
                )}
                <button onClick={handleRecordReading} className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 ${isDarkMode ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}><span>✅</span></button>
                <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold px-2 py-1.5 rounded-lg truncate max-w-[80px] ${isDarkMode ? 'bg-[#333]' : 'bg-emerald-50'}`}>{viewMode === 'SCROLL' ? currentChapterName : `ص ${currentPage}`}</span>
                    <button onClick={() => setShowChapters(true)} className={`px-2 py-1.5 rounded-lg text-xs font-bold ${theme.inactiveBtn}`}>☰</button>
                </div>
            </div>
          </div>

          <div className="flex-1 relative w-full h-full min-h-0">
            <div ref={scrollContainerRef} className={`absolute inset-0 pb-40 ${theme.bg} overflow-y-scroll`} style={{ scrollbarGutter: "stable" }} onTouchStart={viewMode === 'PAGE' ? onTouchStart : undefined} onTouchMove={viewMode === 'PAGE' ? onTouchMove : undefined} onTouchEnd={viewMode === 'PAGE' ? onTouchEnd : undefined}>
              <div className="max-w-4xl mx-auto px-4 py-8 min-h-full">
                {loading ? (
                  <div className="p-20 text-center"><div className="w-8 h-8 border-4 border-emerald-500 rounded-full animate-spin mx-auto"></div></div>
                ) : (
                  <div className="animate-fade-in">
                    {viewMode === 'PAGE' ? (
                        <div className={`border p-4 md:p-8 min-h-[60vh] rounded flex items-center ${isDarkMode ? 'border-[#333]' : 'border-[#ebebeb]'}`}>
                          <div className={`text-justify leading-[3.5] text-2xl md:text-3xl font-amiri w-full ${theme.text}`} dir="rtl">
                              {verses.map((v) => (
                              <span key={v.id} onClick={() => openTafsir(v)} className="inline cursor-pointer hover:bg-emerald-500/10 rounded px-1 transition-colors">
                                  {v.text_uthmani || v.text_uthmani_simple}
                                  <span className={`inline-flex items-center justify-center min-w-[30px] h-[30px] mx-1 align-middle rounded-full text-[0.4em] font-sans border opacity-70 ${isDarkMode ? 'bg-[#333] border-[#555]' : 'bg-[#f0f0f0]'}`}>{v.verse_number}</span>
                              </span>
                              ))}
                          </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center pb-6 border-b border-dashed border-gray-500/30 mb-6">
                              <h2 className={`font-amiri font-bold text-3xl ${theme.text}`}>{currentChapterName}</h2>
                            </div>
                            {verses.map((v) => (
                                <div key={v.id} className={`rounded-3xl p-6 text-center shadow-sm border ${isDarkMode ? 'bg-[#252525] border-[#333]' : 'bg-white/80 border-slate-100'}`}>
                                    <p className={`font-amiri text-2xl md:text-3xl leading-loose mb-4 ${theme.text}`}>{v.text_uthmani || v.text_uthmani_simple}</p>
                                    <div className="flex justify-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isDarkMode ? 'bg-[#333] text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>{v.verse_number}</span>
                                        <button onClick={() => openTafsir(v)} className={`px-3 py-1 rounded-full text-xs font-bold ${theme.inactiveBtn}`}>تفسير</button>
                                    </div>
                                </div>
                            ))}
                            <div className="text-center py-10 opacity-70 flex flex-col items-center gap-3">
                                <button onClick={handleRecordReading} className={`px-6 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>✅ ختمت القراءة</button>
                                {currentSurahId < 114 && <button onClick={() => setCurrentSurahId(s => s + 1)} className={`px-6 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>التالية &larr;</button>}
                            </div>
                        </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================
           TAB 2: AUDIO ONLY (LISTEN)
         ============================================== */}
      {activeTab === 'AUDIO_ONLY' && (
        <div className={`flex-1 flex flex-col p-4 overflow-hidden relative animate-fade-in ${theme.bg}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>
               الاستماع (صوت فقط)
            </h3>
          </div>
          
          {!selectedReciter ? (
            <>
              <div className="relative mb-4">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث عن قارئ..." className={`w-full p-3 rounded-xl border outline-none ${theme.inputBg}`} />
              </div>
              {filteredReciters.length === 0 ? (
                 <div className="flex justify-center p-10"><div className="text-sm opacity-50">لا يوجد نتائج</div></div>
              ) : (
                <div className="flex-1 overflow-y-auto pb-40 space-y-6 min-h-0">
                  <div className="grid grid-cols-2 gap-3">
                    {filteredReciters.map((reciter, idx) => (
                      <div key={idx} onClick={() => { setSelectedReciter(reciter); setSelectedRecitationIndex(0); }} className={`p-4 rounded-xl border cursor-pointer active:scale-95 transition-all ${isDarkMode ? 'bg-[#243042] border-blue-900 hover:border-blue-500' : 'bg-white border-blue-100 shadow-sm'}`}>
                        <p className="font-bold text-sm mb-1">{reciter.ar}</p>
                        <p className={`text-[10px] opacity-70`}>{reciter.en}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className={`p-4 rounded-xl mb-4 border flex flex-col gap-2 ${isDarkMode ? 'bg-[#243042] border-blue-900' : 'bg-white border-blue-100'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-bold ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>{selectedReciter.ar}</h3>
                    <button onClick={() => { setSelectedReciter(null); setIsRadioPlaying(false); }} className="text-xs mt-1 underline text-blue-500">تغيير القارئ</button>
                  </div>
                  
                  {/* Recitation Type Selection (Riwayat) */}
                  {selectedReciter.recitations.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {selectedReciter.recitations.map((r, idx) => {
                            const name = r.tags || QIRAAT_NAMES[Number(r.qiraah || 0)] || (idx === 0 ? 'مرتل' : `رواية ${idx + 1}`);
                            return (
                                <button 
                                    key={idx}
                                    onClick={() => setSelectedRecitationIndex(idx)}
                                    className={`px-3 py-1 rounded-full text-[10px] whitespace-nowrap border ${selectedRecitationIndex === idx ? (isDarkMode ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-100 border-blue-200 text-blue-800') : (isDarkMode ? 'border-gray-600 text-gray-400' : 'border-gray-200 text-gray-500')}`}
                                >
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                  )}
              </div>

              <div className="flex-1 overflow-y-auto pb-48 space-y-1">
                {Array.from({ length: 114 }, (_, i) => i + 1).map(sNum => {
                  const chapter = chapters.find(c => c.id === sNum);
                  const isPlaying = playingSurahNum === sNum && isRadioPlaying;
                  return (
                  <div key={sNum} onClick={() => handleSelectRadioSurah(sNum)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${playingSurahNum === sNum ? (isDarkMode ? 'bg-blue-900/60' : 'bg-blue-100') : (isDarkMode ? 'hover:bg-[#243042]' : 'hover:bg-white')}`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'}`}>{sNum}</span>
                        <span className="font-bold font-amiri">{chapter?.name_arabic}</span>
                      </div>
                      {isPlaying && !buffering && <span className="text-blue-500 text-xs animate-pulse">▶ جاري التشغيل</span>}
                      {playingSurahNum === sNum && buffering && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                  </div>
                )})}
              </div>
              
              {/* MINI PLAYER BAR FOR AUDIO_ONLY MODE */}
              {playingSurahNum && (
                <div className={`absolute bottom-4 left-4 right-4 p-3 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up border ${isDarkMode ? 'bg-[#222] border-[#444]' : 'bg-white border-blue-100'}`}>
                    <button onClick={toggleRadioPlay} className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}`}>
                       {buffering ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (isRadioPlaying ? '⏸' : '▶')}
                    </button>
                    <div className="flex-1">
                       <p className="text-xs font-bold mb-1">سورة {chapters.find(c => c.id === playingSurahNum)?.name_arabic}</p>
                       <div className={`h-1 rounded-full cursor-pointer relative overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} onClick={seekAudio}>
                           <div className={`h-full absolute right-0 top-0 transition-all ${isDarkMode ? 'bg-blue-500' : 'bg-blue-500'}`} style={{ width: `${(radioCurrentTime / (radioDuration || 1)) * 100}%` }}></div>
                       </div>
                    </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showChapters && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowChapters(false)}>
          <div className={`w-full max-w-sm h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col ${theme.controlBg}`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 border-b flex justify-between ${theme.border}`}>
              <span className="font-bold">فهرس السور</span>
              <button onClick={() => setShowChapters(false)}>✕</button>
            </div>
            <div className="flex-1 overflow-y-scroll p-2 space-y-1">
              {chapters.map((ch) => (
                <button key={ch.id} onClick={() => goToSurah(ch)} className={`w-full text-right px-4 py-3 rounded-xl border flex justify-between ${theme.inactiveBtn} ${isDarkMode ? 'hover:bg-[#333]' : 'bg-white'}`}>
                  <span className="font-amiri font-bold">{ch.name_arabic}</span>
                  <span className="text-xs opacity-50">{ch.pages[0]} ص</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tafsirOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setTafsirOpen(false)}>
          <div className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] ${theme.controlBg}`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 border-b flex justify-between ${theme.border}`}>
              <span className="font-bold truncate max-w-[80%]">{tafsirTitle}</span>
              <button onClick={() => setTafsirOpen(false)}>✕</button>
            </div>
            <div className={`flex-1 overflow-y-scroll p-6 text-justify leading-9 font-amiri text-lg ${theme.text}`} dangerouslySetInnerHTML={{ __html: sanitizeHtmlBasic(tafsirHtml) }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default QuranScreen;
