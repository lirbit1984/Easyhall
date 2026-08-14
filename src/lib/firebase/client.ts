import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
export const functions = app ? getFunctions(app) : null;

// App Check מוכיח לשרת שהקריאה הגיעה מדפדפן שטוען את האתר האמיתי, לא
// מסקריפט חיצוני — קריטי בעיקר ל-submitSiteLead שפתוחה בלי התחברות.
// רץ בדפדפן בלבד (typeof window) כי הוא תלוי ב-reCAPTCHA שרץ מול ה-DOM,
// ולא באכיפה (isTokenAutoRefreshEnabled בלבד) עד שנבדוק שהטוקנים אכן
// מגיעים לשרת — אכיפה מוקדמת מדי הייתה חוסמת גם משתמשים אמיתיים.
if (app && typeof window !== "undefined") {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    // מאפשר בדיקה מקומית (localhost) בלי לחסום את עצמך בזמן פיתוח: מדפיס
    // טוקן דיבאג חד-פעמי לקונסולה שצריך לרשום ידנית בקונסולת Firebase
    // תחת App Check > Apps > "Manage debug tokens".
    if (process.env.NODE_ENV !== "production") {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}
