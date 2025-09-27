// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";
import { getAuth, type Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Main app Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUpmdKntEMOsTm6J2wdSiNTcQqvszVjnE",
  authDomain: "driverprofile-82715.firebaseapp.com",
  databaseURL: "https://driverprofile-82715-default-rtdb.firebaseio.com",
  projectId: "driverprofile-82715",
  storageBucket: "driverprofile-82715.appspot.com",
  messagingSenderId: "458114014927",
  appId: "1:458114014927:web:9db764a35e2bad4c26a1ba",
  measurementId: ""
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let database: Database;
let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  if (!getApps().some(app => app.name === 'DEFAULT')) {
    try {
      app = initializeApp(firebaseConfig); // Initialize default app
      auth = getAuth(app);
      database = getDatabase(app);
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