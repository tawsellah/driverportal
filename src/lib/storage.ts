
"use client"

// This file is significantly refactored.
// Most data storage logic is now handled by Firebase services.
// localStorage is primarily used for client-side auth status flag.

import type { SeatID } from './constants';
import { type UserProfile as FirebaseUserProfile, type Trip as FirebaseTrip, addTrip as fbAddTrip, updateTrip as fbUpdateTrip, deleteTrip as fbDeleteTrip, getTrips as fbGetTrips, getUserProfile as fbGetUserProfile, saveUserProfile as fbSaveUserProfile } from './firebaseService';

// Re-export types for convenience if needed, or import directly from firebaseService
export type UserProfile = FirebaseUserProfile;
export type Trip = FirebaseTrip;
export type NewTripData = Omit<Trip, 'id' | 'status' | 'selectedSeats' | 'passengers' | 'earnings' | 'driverId'>;


const AUTH_KEY = 'tawsellah-isLoggedIn';

// --- Auth Status (Client-side flag) ---
export const getAuthStatus = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_KEY) === 'true';
};

export const setAuthStatus = (isLoggedIn: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_KEY, String(isLoggedIn));
};


// --- Mock Initial Data (REMOVED as Firebase is the source of truth) ---
// export const initializeMockData = () => { ... }
// Old localStorage based functions are removed or adapted to call Firebase services.
// For example, if you had a local 'addTrip', it would now call the Firebase service version.

// The component files will now directly import and use functions from `firebaseService.ts`
// for data operations, or use a context/store that wraps these services.
// This file `storage.ts` can be gradually phased out or repurposed for non-Firebase local storage needs if any.

// For compatibility with existing imports if any, we can re-export some firebaseService functions,
// but it's cleaner for components to import from firebaseService directly.
// Example of re-exporting (optional):
// export const addTrip = fbAddTrip;
// export const getTrips = fbGetTrips;
// etc.

// It's generally better to update component imports to use firebaseService.ts directly.
