
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ============================================================
// 🔴 منطقة المفاتيح: انسخ بياناتك من Firebase Console وضعها هنا
// ============================================================
// 1. اذهب إلى Project Settings > General > Your apps
// 2. انسخ القيم الموجودة في firebaseConfig
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAPLg1gW3Q6XAaTun_MlQ0fxxpW4ghVf54",
  authDomain: "fathakkir-56567.firebaseapp.com",
  projectId: "fathakkir-56567",
  storageBucket: "fathakkir-56567.firebasestorage.app",
  messagingSenderId: "448789782854",
  appId: "1:448789782854:web:166b8c671635c12e4d0547",
};


// ============================================================

// Check if keys are placeholders
// إذا كانت المفاتيح لا تزال افتراضية، سيعمل التطبيق في وضع المحاكاة (Mock Mode)
const isConfigured = firebaseConfig.apiKey !== "AIzaSy_YOUR_API_KEY_HERE" && !firebaseConfig.apiKey.includes("YOUR_API_KEY");

export const isMockMode = !isConfigured;

if (isMockMode) {
  console.warn("⚠️ تنبيه: التطبيق يعمل في وضع المحاكاة (Mock Mode) لأن مفاتيح Firebase لم يتم إدخالها بعد.");
  console.warn("⚠️ لتفعيل المشاركة الحقيقية بين الأعضاء، يرجى تحديث ملف firebaseConfig.ts بالمفاتيح الخاصة بك.");
}

// Initialize Firebase conditionally
let app;
let dbInstance;
let authInstance;

try {
  if (isConfigured) {
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    console.log("✅ تم الاتصال بـ Firebase بنجاح");
  } else {
    // Initialize dummy instances for typing purposes only, they won't be used in Mock Mode logic usually
    // or create a fake app instance to prevent crashes if code tries to access it
    app = initializeApp(firebaseConfig); 
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
  }
} catch (error) {
  console.error("Firebase init error:", error);
}

export const db = dbInstance;
export const auth = authInstance;
