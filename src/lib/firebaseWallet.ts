// src/lib/firebaseWallet.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// Wallet-specific Firebase configuration
const firebaseWalletConfig = {
  apiKey: "AIzaSyBiXvq7vl2hwvQkoEcZbmVq5mD_c59skZg",
  authDomain: "wallet-driver-5ff37.firebaseapp.com",
  databaseURL: "https://wallet-driver-5ff37-default-rtdb.firebaseio.com",
  projectId: "wallet-driver-5ff37",
  storageBucket: "wallet-driver-5ff37.appspot.com",
  messagingSenderId: "464638560961",
  appId: "1:464638560961:web:5bf3f8e58319e78267a240"
};

const WALLET_APP_NAME = "walletApp";

let walletApp: FirebaseApp;
let database: Database;

if (typeof window !== 'undefined') {
  const existingApp = getApps().find(app => app.name === WALLET_APP_NAME);
  if (existingApp) {
    walletApp = existingApp;
  } else {
    try {
      walletApp = initializeApp(firebaseWalletConfig, WALLET_APP_NAME);
    } catch (e) {
      console.error("Firebase Wallet App initialization failed.", e);
      // @ts-ignore
      walletApp = null;
    }
  }

  if (walletApp) {
    try {
      database = getDatabase(walletApp);
    } catch(e) {
      console.error("Failed to get wallet database instance.", e);
      // @ts-ignore
      database = null;
    }
  }
}

// @ts-ignore
export { walletApp, database };
