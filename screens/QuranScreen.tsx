import React, { useState, useEffect } from 'react';
import { User, Surah, ActivityType } from '../types';
import { fetchSurahDetails, fetchAsbabAlNuzul } from '../services/api';

interface QuranScreenProps {
  user: User;
  addLog: (type: ActivityType, summary: string, details?: string) => void;
}

const QuranScreen: React.FC<QuranScreenProps> = ({ user, addLog }) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Reader State
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [surahContent, setSurahContent] = useState<{ text: any, audioUrl: string } | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [errorContent, setErrorContent] = useState(false);
  
  // Asbab State
  const [allAsbab, setAllAsbab] = useState<any>(null);
  const [currentAsbab, setCurrentAsbab] = useState<string | null>(null);
  const [showAsbab, setShowAsbab] = useState(false);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 1. Fetch Surah List
    const cached = localStorage.getItem('surahs_list');
    if (cached) {
      setSurahs(JSON.parse(cached));
      setLoading(false);
    } else {
      fetch('https://api.alquran.cloud/v1/surah')
        .then(res => res.json())
        .then(data => {
          setSurahs(data.data);
          localStorage.setItem('surahs_list', JSON.stringify(data.data));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }

    // 2. Fetch Asbab DB
    fetchAsbabAlNuzul().then(data => setAllAsbab(data));
  }, []);

  const openSurah = async (surah: Surah) => {
    setSelectedSurah(surah);
    setLoadingContent(true);
    setSurahContent(null);
    setErrorContent(false);
    setShowAsbab(false);
    
    // Find Asbab
    if (allAsbab && allAsbab[surah.number]) {
       setCurrentAsbab(allAsbab[surah.number]['sabab_nuzuliha']);
    } else {
       setCurrentAsbab(null);
    }
    
    try {
      const data = await fetchSurahDetails(surah.number);
      setSurahContent(data);
      
      // Setup Audio
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
      const newAudio = new Audio(data.audioUrl);
      newAudio.addEventListener('ended', () => setIsPlaying(false));
      setAudioEl(newAudio);

    } catch (e) {
      console.error(e);
      setErrorContent(true);
    } finally {
      setLoadingContent(false);
    }
  };

  const togglePlay = () => {
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.pause();
    } else {
      audioEl.play().catch(e => alert("عذرا، حدث خطأ في تشغيل الصوت"));
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    return () => {
      if (audioEl) audioEl.pause(); // Cleanup
    };
  }, [audioEl]);

  if (selectedSurah) {
    return (
      <div className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#f8fafc] z-10 py-2 border-b border-slate-100">
          <button onClick={() => { setSelectedSurah(null); if(audioEl) audioEl.pause(); setIsPlaying(false); }} className="text-slate-500">← الفهرس</button>
          <div className="text-center">
             <h2 className="text-xl font-amiri font-bold text-emerald-800">سورة {selectedSurah.name}</h2>
          </div>
          <button 
             onClick={togglePlay}
             disabled={loadingContent || errorContent}
             className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm ${isPlaying ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}
          >
             {isPlaying ? '⏸' : '▶'}
          </button>
        </div>

        {loadingContent && (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
             <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <span>جاري تحميل الآيات...</span>
           </div>
        )}

        {errorContent && (
           <div className="flex-1 flex flex-col items-center justify-center text-red-400">
             <p>حدث خطأ في تحميل السورة.</p>
             <button onClick={() => openSurah(selectedSurah)} className="mt-4 text-slate-600 underline">إعادة المحاولة</button>
           </div>
        )}

        {!loadingContent && !errorContent && surahContent && (
          <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
            {/* Basmalah */}
            <div className="text-center font-amiri text-2xl mb-8 mt-4 text-slate-800">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
            
            {/* Ayahs */}
            <div className="space-y-6 text-right" dir="rtl">
              {surahContent.text.ayahs.map((ayah: any) => (
                <span key={ayah.number} className="inline leading-[2.5] text-xl font-amiri text-slate-800 text-justify">
                  {ayah.text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', '')} 
                  <span className="inline-flex items-center justify-center w-8 h-8 mx-1 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-400 font-sans number-font select-none">
                    {ayah.numberInSurah}
                  </span>
                </span>
              ))}
            </div>

            {/* Asbab al-Nuzul Accordion */}
            <div className="mt-8 border-t border-slate-200 pt-4">
              <button 
                onClick={() => setShowAsbab(!showAsbab)}
                className="flex items-center justify-between w-full p-4 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span>📖 سبب النزول</span>
                <span>{showAsbab ? '▲' : '▼'}</span>
              </button>
              {showAsbab && (
                <div className="p-4 bg-white border border-slate-100 mt-2 rounded-xl text-sm text-slate-600 leading-relaxed shadow-sm">
                   {currentAsbab ? currentAsbab : "غير متوفر لهذه السورة."}
                   <div className="mt-2 text-[10px] text-slate-400 text-left">المصدر: البطاقات القرآنية</div>
                </div>
              )}
            </div>

            <button 
              onClick={() => { addLog(ActivityType.QURAN, `قرأ سورة ${selectedSurah.name}`); setSelectedSurah(null); if(audioEl) audioEl.pause(); }}
              className="w-full mt-8 py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
            >
              تمت القراءة
            </button>
          </div>
        )}
      </div>
    );
  }

  // Index View
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-emerald-600 text-white rounded-b-3xl shadow-lg mb-4">
        <h2 className="text-2xl font-amiri font-bold mb-2">القرآن الكريم</h2>
        <p className="text-emerald-100 text-sm">اختر سورة للبدء</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20 no-scrollbar">
        {loading ? (
          <div className="text-center p-8 text-slate-400">جاري تحميل السور...</div>
        ) : (
          <div className="space-y-2">
            {surahs.map((surah) => (
              <button
                key={surah.number}
                onClick={() => openSurah(surah)}
                className="w-full flex items-center p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 font-bold flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  {surah.number}
                </div>
                <div className="mr-4 text-right flex-1">
                  <h3 className="font-bold text-slate-800 text-lg font-amiri">{surah.name}</h3>
                  <p className="text-xs text-slate-400">{surah.englishNameTranslation} • {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</p>
                </div>
                <div className="text-xs text-slate-300">
                  {surah.numberOfAyahs} آية
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuranScreen;
