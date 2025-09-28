// src/lib/firebaseTrips.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// Trips-specific Firebase configuration
const firebaseTripsConfig = {
  apiKey: "AIzaSyCRyk1p36qdQwRDePOEIXOE_ajf86Oz4ak",
  authDomain: "trips-24e28.firebaseapp.com",
  databaseURL: "https://trips-24e28-default-rtdb.firebaseio.com",
  projectId: "trips-24e28",
  storageBucket: "trips-24e28.appspot.com",
  messagingSenderId: "683086717653",
  appId: "1:683086717653:web:afc24546419b6748b7f85c" // Example Web App ID
};

const TRIPS_APP_NAME = "tripsApp";

let tripsApp: FirebaseApp;
let database: Database;

if (typeof window !== 'undefined') {
  const existingApp = getApps().find(app => app.name === TRIPS_APP_NAME);
  if (existingApp) {
    tripsApp = existingApp;
  } else {
    try {
      tripsApp = initializeApp(firebaseTripsConfig, TRIPS_APP_NAME);
    } catch (e) {
      console.error("Firebase Trips App initialization failed.", e);
      // @ts-ignore
      tripsApp = null;
    }
  }

  if (tripsApp) {
    try {
      database = getDatabase(tripsApp);
    } catch(e) {
      console.error("Failed to get trips database instance.", e);
      // @ts-ignore
      database = null;
    }
  }
}

// @ts-ignore
export { tripsApp, database };
