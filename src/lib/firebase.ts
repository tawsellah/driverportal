// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";
import { getAuth, type Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
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
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    // Explicitly set persistence to 'local' to keep user signed in
    setPersistence(auth, browserLocalPersistence); 
    isSupported().then((supported) => {
      if (supported && firebaseConfig.measurementId) {
        analytics = getAnalytics(app);
      }
    });
  } else {
    app = getApp();
    auth = getAuth(app);
    database = getDatabase(app);
    if (firebaseConfig.measurementId) {
      isSupported().then((supported) => {
        if (supported) {
          try {
            analytics = getAnalytics(app);
          } catch (e) {
            analytics = null;
          }
        }
      });
    }
  }
}

export { app, auth, database, analytics };
