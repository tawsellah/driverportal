// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC8kTTftLNRLa_GTJjubUMucnx1Tll8r4A",
  authDomain: "tawsellah3.firebaseapp.com",
  databaseURL: "https://tawsellah3-default-rtdb.firebaseio.com",
  projectId: "tawsellah3",
  storageBucket: "tawsellah3.firebasestorage.app",
  messagingSenderId: "483733605153",
  appId: "1:483733605153:web:1f63e97390d1be760a0c60",
  measurementId: "G-J3DT6794Q3"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let database: Database;
let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  database = getDatabase(app);
  // Initialize Analytics only if supported and in browser
  if (firebaseConfig.measurementId) {
    analytics = getAnalytics(app);
  }
} else {
  // Provide non-functional stubs or handle server-side appropriately if needed
  // For this client-heavy app, direct server-side Firebase might not be used extensively
  // but good to have placeholders if ever needed.
}

export { app, auth, database, analytics };
