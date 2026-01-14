

import { 
  ChaptersResponse, Chapter, 
  RecitationsResponse, Recitation,
  TafsirResourcesResponse, TafsirResource,
  VersesResponse, Verse, 
  AudioFile 
} from '../types/quran';

const BASE_URL = 'https://api.quran.com/api/v4';

// Simple in-memory cache
const cache = new Map<string, any>();

async function getJson<T>(url: string): Promise<T> {
  if (cache.has(url)) return cache.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    const data = await response.json();
    cache.set(url, data);
    return data;
  } catch (error) {
    console.error("Quran API Error:", error);
    throw error;
  }
}

/**
 * Helper to display Arabic name if available, otherwise fallback.
 */
export function displayArabicName(
  x: { name?: string; translated_name?: { name: string; language_name: string }; reciter_name?: string }
) {
  const tn = x.translated_name;
  if (tn && (tn.language_name || "").toLowerCase().includes("arab")) return tn.name;
  return x.name || x.reciter_name || "بدون اسم";
}

// List of reciters verified to have reliable verse timings (segments) for sync mode
export const VERIFIED_SYNC_NAMES = [
  "Mishary Rashid Alafasy",
  "Mahmoud Khalil Al-Husary",
  "AbdulBaset AbdulSamad",
  "Mohamed Siddiq Al-Minshawi",
  "Saad Al-Ghamdi"
];

export const getChapters = async (): Promise<Chapter[]> => {
  const url = `${BASE_URL}/chapters?language=ar`;
  const data = await getJson<ChaptersResponse>(url);
  return data.chapters;
};

export const getRecitations = async (): Promise<Recitation[]> => {
  const url = `${BASE_URL}/resources/recitations?language=ar`;
  const data = await getJson<RecitationsResponse>(url);
  return data.recitations;
};

export const getTafsirResources = async (): Promise<TafsirResource[]> => {
  const url = `${BASE_URL}/resources/tafsirs?language=ar`;
  const data = await getJson<TafsirResourcesResponse>(url);
  return data.tafsirs;
};

export const getVersesByPage = async (page: number): Promise<Verse[]> => {
  // Use text_uthmani_simple to ensure compatibility if font is missing
  const url = `${BASE_URL}/verses/by_page/${page}?fields=text_uthmani,text_uthmani_simple&words=false`;
  const data = await getJson<{ verses: Verse[] }>(url);
  return data.verses;
};

// NEW: Fetch full Surah (Max 300 verses per page covers the largest Surah Al-Baqarah 286)
export const getVersesByChapter = async (chapterId: number): Promise<Verse[]> => {
  // Use text_uthmani_simple to ensure compatibility if font is missing
  const url = `${BASE_URL}/verses/by_chapter/${chapterId}?fields=text_uthmani,text_uthmani_simple&words=false&per_page=300`;
  const data = await getJson<{ verses: Verse[] }>(url);
  return data.verses;
};

export const getTafsirForAyah = async (resourceId: number, verseKey: string): Promise<string> => {
  const data = await getJson<any>(`${BASE_URL}/tafsirs/${resourceId}/by_ayah/${encodeURIComponent(verseKey)}`);
  return data?.tafsir?.text ?? "";
};

// Legacy support (defaults to Sa'di)
export const getTafsir = async (verseKey: string): Promise<string> => {
  return getTafsirForAyah(169, verseKey);
};

export const getAudioUrlForVerse = async (recitationId: number, verseKey: string): Promise<string> => {
  const url = `${BASE_URL}/audio_files?recitation_id=${recitationId}&verse_key=${encodeURIComponent(verseKey)}`;
  const data = await getJson<{ audio_files: AudioFile[] }>(url);
  const f = data.audio_files?.[0];
  const raw = f?.audio_url || f?.url || "";

  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://verses.quran.com${raw}`;
};

export const getReciterPreviewUrl = async (recitationId: number): Promise<string> => {
  return getAudioUrlForVerse(recitationId, "1:1");
};

export const getChapterAudio = async (recitationId: number, chapterId: number) => {
  const url = `${BASE_URL}/chapter_recitations/${recitationId}/${chapterId}`;
  const data = await getJson<{ audio_file: any }>(url);
  return data.audio_file;
};
