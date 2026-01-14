

export interface Chapter {
  id: number;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number]; // Updated to tuple for page range
  translated_name: {
    language_name: string;
    name: string;
  };
}

export interface ChaptersResponse {
  chapters: Chapter[];
}

export interface Recitation {
  id: number;
  reciter_name: string;
  style?: string;
  translated_name?: {
    name: string;
    language_name: string;
  };
}

export interface RecitationsResponse {
  recitations: Recitation[];
}

export interface TafsirResource {
  id: number;
  name: string;
  language_name: string;
  author_name: string;
  slug: string;
  translated_name?: {
    name: string;
    language_name: string;
  };
}

export interface TafsirResourcesResponse {
  tafsirs: TafsirResource[];
}

export interface AudioFile {
  verse_key: string;
  url?: string;
  audio_url?: string;
  file_name?: string;
}

export interface Translation {
  id: number;
  resource_id: number;
  text: string;
}

export interface Verse {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  text_uthmani_simple?: string; // Added field
  translations?: Translation[];
  audio?: AudioFile;
}

export interface Pagination {
  per_page: number;
  current_page: number;
  next_page: number | null;
  total_pages: number;
  total_records: number;
}

export interface VersesResponse {
  verses: Verse[];
  pagination: Pagination;
}

export interface TafsirResponse {
  tafsir: {
    resource_id: number;
    text: string;
  };
}

export interface VerseTiming {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
  duration: number;
  segments: [number, number, number][];
}
