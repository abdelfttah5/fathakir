import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Helper to safely get env vars
const getEnv = (key: string) => {
  try {
     // @ts-ignore
     if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
  } catch(e) {}
  try {
     if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  } catch(e) {}
  return null;
};

const apiKey = getEnv('VITE_FIREBASE_API_KEY') || "AIzaSy_YOUR_API_KEY_HERE";

export const firebaseConfig = {
  apiKey: apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Check if keys are placeholders
export const isMockMode = apiKey.includes('YOUR_API_KEY') || !apiKey;

if (isMockMode) {
  console.warn("⚠️ Running in MOCK MODE because valid Firebase keys were not found.");
}

// Initialize Firebase conditionally
let app;
let dbInstance;
let authInstance;

try {
  // We only init if we think we might have keys, or just to export the types.
  // Even with bad keys, initializeApp might not throw until usage.
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
} catch (error) {
  console.error("Firebase init error (ignored in mock mode):", error);
}

export const db = dbInstance;
export const auth = authInstance;