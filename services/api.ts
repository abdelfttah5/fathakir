import { ZekrItem, AzkarJSON } from '../types';
import { STATIC_AZKAR } from '../constants';

const AZKAR_CACHE_KEY = 'azkar_cache_v6'; // Bump version
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Hours

const AZKAR_URLS = [
  'https://cdn.jsdelivr.net/gh/Seen-Arabic/Morning-And-Evening-Adhkar-DB@main/ar.json',
  'https://cdn.jsdelivr.net/gh/osamayy/azkar-db@master/azkar.json'
];

// Helper: Normalize Category Names to match our UI Grid
// This ensures that whatever the API calls it, we map it to our UI labels
const normalizeCategoryName = (rawName: string): string => {
  const n = rawName.trim();
  
  // Strict mapping
  if (n.includes('صباح') || n.includes('Morning')) return 'أذكار الصباح';
  if (n.includes('مساء') || n.includes('Evening')) return 'أذكار المساء';
  if (n.includes('نوم') || n.includes('Sleep')) return 'أذكار النوم';
  if (n.includes('استيقاظ') || n.includes('Wake')) return 'أذكار الاستيقاظ';
  if (n.includes('آذان') || n.includes('Adhan')) return 'أذكار الآذان';
  if (n.includes('وضوء') || n.includes('Ablution')) return 'أذكار الوضوء';
  if (n.includes('مسجد') || n.includes('Mosque')) return 'أذكار المسجد';
  if (n.includes('منزل') || n.includes('Home')) return 'أذكار المنزل';
  if (n.includes('خلاء') || n.includes('Toilet')) return 'أذكار الخلاء';
  if (n.includes('طعام') || n.includes('Food')) return 'أذكار الطعام';
  if (n.includes('حج') || n.includes('Hajj') || n.includes('عمرة')) return 'أذكار الحج والعمرة';
  
  if ((n.includes('صلاة') && n.includes('بعد')) || n.includes('Post Prayer')) return 'أذكار بعد الصلاة';
  
  if (n.includes('قرآن') && (n.includes('ختم') || n.includes('دعاء'))) return 'دعاء ختم القرآن الكريم';
  if (n.includes('انبياء') || n.includes('أنبياء')) return 'أدعية الأنبياء';
  if (n.includes('قرآني')) return 'الأدعية القرآنية';
  if (n.includes('متفرق')) return 'أذكار متفرقة';
  if (n.includes('رقية') || n.includes('شرعية')) return 'الرقية الشرعية';
  if (n.includes('جوامع')) return 'جوامع الدعاء';
  if (n.includes('ميت') || n.includes('الميت')) return 'أدعية للميت';
  if (n.includes('أسماء الله')) return 'أسماء الله الحسنى';
  
  return n; 
};

const processAzkarData = (rawData: any): AzkarJSON => {
  let flatList: any[] = [];

  // SCENARIO A: Data is in "Database Dump" format (columns/rows)
  if (rawData && typeof rawData === 'object' && Array.isArray(rawData.columns) && Array.isArray(rawData.rows)) {
    const cols = rawData.columns; 
    flatList = rawData.rows.map((row: any[]) => {
      const item: any = {};
      cols.forEach((colName: string, index: number) => {
        item[colName] = row[index];
      });
      return item;
    });
  }
  // SCENARIO B: Data is a standard Array of Objects
  else if (Array.isArray(rawData)) {
    flatList = rawData;
  }
  // SCENARIO C: Data is Object grouped by category name
  else if (rawData && typeof rawData === 'object') {
    Object.keys(rawData).forEach(key => {
      if (Array.isArray(rawData[key])) {
         const firstItem = rawData[key][0];
         if (firstItem && (typeof firstItem === 'object')) {
            rawData[key].forEach((item: any) => {
              flatList.push({ ...item, category: key });
            });
         }
      }
    });
  }

  const groupedData: AzkarJSON = {};

  flatList.forEach((item) => {
    const zekrText = item.zekr || item.content || item.text || item.description;
    const catRaw = item.category || "أذكار متنوعة";
    const countVal = item.count || "1";
    const desc = item.description || "";
    const ref = item.reference || "";

    if (!zekrText) return; 

    // Normalize Category Name here
    const catName = normalizeCategoryName(catRaw);

    if (!groupedData[catName]) {
      groupedData[catName] = [];
    }

    // Avoid duplicates if possible
    const exists = groupedData[catName].some(z => z.zekr === zekrText);
    if (!exists) {
      groupedData[catName].push({
        category: catName,
        zekr: zekrText,
        count: String(countVal),
        description: desc === zekrText ? "" : desc,
        reference: ref
      });
    }
  });

  return groupedData;
};

export const fetchAllAzkarDB = async (): Promise<AzkarJSON> => {
  // STRATEGY: 
  // 1. Initialize with STATIC_AZKAR (Guarantee functionality).
  // 2. Try to merge with cached/network data.
  
  let finalData: AzkarJSON = { ...STATIC_AZKAR };

  // 1. Check Cache and merge
  try {
    const cached = localStorage.getItem(AZKAR_CACHE_KEY);
    if (cached) {
      const { fetchedAt, data } = JSON.parse(cached);
      // Merge cached data into static data
      Object.keys(data).forEach(key => {
        if (data[key] && data[key].length > 0) {
          finalData[key] = data[key];
        }
      });
      // If cache is fresh, return combined
      if (Date.now() - fetchedAt < CACHE_DURATION) {
         return finalData;
      }
    }
  } catch (e) {
    localStorage.removeItem(AZKAR_CACHE_KEY);
  }

  // 2. Network Fetch (Enhancement)
  // If this fails, we still return the finalData (which contains STATIC_AZKAR)
  for (const url of AZKAR_URLS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const rawData = await response.json();
        const processed = processAzkarData(rawData);
        
        if (Object.keys(processed).length > 0) {
          // Merge processed into static
          Object.keys(processed).forEach(key => {
             finalData[key] = processed[key];
          });
          
          localStorage.setItem(AZKAR_CACHE_KEY, JSON.stringify({
            fetchedAt: Date.now(),
            data: processed // We cache the network data
          }));
          return finalData;
        }
      }
    } catch (err) {
      // Ignore network errors, fallback is ready
      console.warn(`Fetch failed for ${url}`);
    }
  }

  return finalData;
};

export const clearAzkarCache = () => {
  localStorage.removeItem(AZKAR_CACHE_KEY);
};

export const fetchAsbabAlNuzul = async (): Promise<any> => {
  try {
    const response = await fetch('https://cdn.jsdelivr.net/gh/rn0x/albitaqat_quran@main/albitaqat.json');
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Asbab Fetch Error", error);
    return null;
  }
};

export const fetchSurahDetails = async (surahNumber: number) => {
  try {
    const textRes = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`);
    const textData = await textRes.json();
    const paddedNum = String(surahNumber).padStart(3, '0');
    const audioUrl = `https://server8.mp3quran.net/afs/${paddedNum}.mp3`;

    return {
      text: textData.data,
      audioUrl: audioUrl
    };
  } catch (error) {
    console.error("Quran Fetch Error", error);
    throw error;
  }
};

export const createGoogleMeetEvent = async (
  title: string, 
  startTime: string, 
  durationMinutes: number,
  accessToken: string | null
): Promise<string | null> => {
  if (!accessToken) return null;
  return "https://meet.google.com/simulated-link";
};
