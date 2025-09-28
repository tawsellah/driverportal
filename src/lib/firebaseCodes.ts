// src/lib/firebaseCodes.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// Codes-specific Firebase configuration from user provided details
const firebaseCodesConfig = {
  apiKey: "AIzaSyCndviEfljgIq9AWjmWuygrnDLfwJmBQGw",
  authDomain: "codescharging.firebaseapp.com",
  databaseURL: "https://codescharging-default-rtdb.firebaseio.com",
  projectId: "codescharging",
  storageBucket: "codescharging.appspot.com", // Assumed from project ID
  messagingSenderId: "", // Not provided, can be empty
  appId: "" // Not provided, can be empty
};

const CODES_APP_NAME = "codesApp";

let codesApp: FirebaseApp;
let database: Database;

if (typeof window !== 'undefined') {
  const existingApp = getApps().find(app => app.name === CODES_APP_NAME);
  if (existingApp) {
    codesApp = existingApp;
  } else {
    try {
      codesApp = initializeApp(firebaseCodesConfig, CODES_APP_NAME);
    } catch (e) {
      console.error("Firebase Codes App initialization failed.", e);
      // @ts-ignore
      codesApp = null;
    }
  }

  if (codesApp) {
    try {
      database = getDatabase(codesApp);
    } catch(e) {
      console.error("Failed to get codes database instance.", e);
      // @ts-ignore
      database = null;
    }
  }
}

// @ts-ignore
export { codesApp, database };
