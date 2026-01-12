
export enum ActivityType {
  DHIKR = 'DHIKR',
  QURAN = 'QURAN',
  PRAYER = 'PRAYER', 
  CHECKIN = 'CHECKIN',
  SADAQAH = 'SADAQAH',
  ZAKAT = 'ZAKAT',
  GOOD_DEED = 'GOOD_DEED',
}

export interface User {
  id: string;
  name: string;
  email?: string;
  isAdmin: boolean;
  isGuest?: boolean;
  avatar?: string;
  privacySettings: {
    showDetails: boolean;
    shareLocation: boolean;
  };
}

export interface Group {
  id: string;
  name: string;
  timezone: string;
  inviteCode?: string;
  inviteExpiresAt?: number;
  inviteMaxUses?: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  type: ActivityType;
  category?: 'GOOD_DEED' | 'STUDY' | 'WELLBEING'; 
  summary: string;
  details?: string;
  timestamp: number;
}

export interface LocationSettings {
  userId: string;
  mode: 'OFF' | 'SHARE_NOW' | 'AUTO_ON_OPEN';
  visibility: 'ALL' | 'SELECTED';
  selectedUserIds: string[];
  accuracy: 'APPROX' | 'PRECISE';
  pauseUntil: number | null;
}

export interface LocationPoint {
  userId: string;
  lat: number;
  lng: number;
  accuracyLabel: 'تقريبي' | 'دقيق';
  timestamp: number;
}

export interface MeetCall {
  id: string;
  initiatorId: string;
  type: 'NOW' | 'SCHEDULED';
  status: 'PENDING' | 'CONFIRMED' | 'ENDED';
  scheduledTime?: number;
  meetLink?: string;
  approvals: string[];
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface AzkarJSON {
  [category: string]: ZekrItem[];
}

export interface ZekrItem {
  category?: string;
  count: string | number;
  description: string;
  reference: string;
  zekr: string;
}

// Reciter Types extracted from provided code
export interface RecitationInfo {
  loc: string; // format "server:path"
  tags?: string;
  qiraah?: string | number;
}

export interface Reciter {
  en: string;
  ar: string;
  recitations: RecitationInfo[];
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
