// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";
import { getAuth, type Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Your web app's Firebase configuration is cleared to disconnect the app.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let database: Database;
let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  if (!getApps().length) {
    try {
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
    } catch (e) {
        console.error("Firebase initialization failed. Please provide a valid configuration.", e);
    }
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

// @ts-ignore
export { app, auth, database, analytics };
