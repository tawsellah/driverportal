
"use client";

import { auth, database } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  type User as FirebaseAuthUser 
} from 'firebase/auth';
import { ref, set, get, child, update, remove, query, orderByChild, equalTo, serverTimestamp } from 'firebase/database';
import type { SeatID } from './constants';

// User Profile Interface
export interface UserProfile {
  id: string; // Firebase Auth UID
  fullName: string;
  email: string; // The t-prefixed email
  phone: string; // Original phone number
  idNumber?: string;
  idPhotoUrl?: string | null; // Simulated Cloudinary URL
  licenseNumber?: string;
  licenseExpiry?: string;
  licensePhotoUrl?: string | null; // Simulated Cloudinary URL
  vehicleType?: string;
  vehicleMakeModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  vehiclePlateNumber?: string;
  vehiclePhotosUrl?: string | null; // Simulated Cloudinary URL
  rating?: number;
  tripsCount?: number;
  paymentMethods?: {
    click?: boolean;
    cash?: boolean;
    clickCode?: string;
  };
  createdAt: any; // Firebase Server Timestamp
}

// Trip Interface
export interface Trip {
  id: string; // Unique trip ID
  driverId: string; // Firebase Auth UID of the driver
  startPoint: string; // Governorate ID
  stops?: string[]; // Array of Governorate IDs
  destination: string; // Governorate ID
  dateTime: string; // ISO string
  expectedArrivalTime: string; // time string e.g., "10:00"
  offeredSeatIds: SeatID[];
  selectedSeats: SeatID[];
  meetingPoint: string;
  pricePerPassenger: number;
  notes?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  earnings?: number;
  passengers?: any[]; // Simplified for now
  createdAt: any; // Firebase Server Timestamp
  updatedAt?: any; // Firebase Server Timestamp
}

export type NewTripData = Omit<Trip, 'id' | 'status' | 'selectedSeats' | 'passengers' | 'earnings' | 'driverId' | 'createdAt' | 'updatedAt'>;

// --- Auth Service ---
export const getCurrentUser = (): FirebaseAuthUser | null => {
  return auth.currentUser;
};

export const onAuthUserChanged = (callback: (user: FirebaseAuthUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// --- User Profile Service ---
export const saveUserProfile = async (userId: string, profileData: Omit<UserProfile, 'id' | 'createdAt'>): Promise<void> => {
  const userRef = ref(database, `users/${userId}`);
  const fullProfileData: UserProfile = {
    id: userId,
    ...profileData,
    createdAt: serverTimestamp(),
  };
  await set(userRef, fullProfileData);
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userRef = ref(database, `users/${userId}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    return snapshot.val() as UserProfile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  const userRef = ref(database, `users/${userId}`);
  await update(userRef, updates);
};


// --- Trip Service ---

// Path for active/current trips
const CURRENT_TRIPS_PATH = 'currentTrips';
// Path for finished trips (example: finishedTrips/driverId/tripId)
const FINISHED_TRIPS_PATH = 'finishedTrips';

export const addTrip = async (driverId: string, tripData: NewTripData): Promise<Trip> => {
  const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newTrip: Trip = {
    ...tripData,
    id: tripId,
    driverId,
    status: 'upcoming',
    selectedSeats: [],
    passengers: [],
    createdAt: serverTimestamp(),
  };
  const tripRef = ref(database, `${CURRENT_TRIPS_PATH}/${tripId}`);
  await set(tripRef, newTrip);
  return newTrip;
};

export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  const tripRef = ref(database, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const updateData = { ...updates, updatedAt: serverTimestamp() };
  await update(tripRef, updateData);
};

export const deleteTrip = async (tripId: string): Promise<void> => {
  // Usually, "deleting" a trip might mean cancelling it.
  // For now, this will update its status to 'cancelled'.
  // True deletion from currentTrips happens when it's moved to finishedTrips.
  await updateTrip(tripId, { status: 'cancelled' });
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
    const tripRef = ref(database, `${CURRENT_TRIPS_PATH}/${tripId}`);
    const snapshot = await get(tripRef);
    if (snapshot.exists()) {
        return snapshot.val() as Trip;
    }
    // Optionally, check finishedTrips if not found in currentTrips
    // This part depends on how driverId is structured in finishedTrips
    return null;
};


export const getActiveTripForDriver = async (driverId: string): Promise<Trip | null> => {
  // WORKAROUND for missing Firebase index on 'driverId' in 'currentTrips'.
  // This fetches ALL current trips and filters client-side.
  // THIS IS INEFFICIENT FOR LARGE DATASETS.
  // The proper fix is to add ".indexOn": "driverId" to your Firebase Realtime Database rules for the 'currentTrips' path.
  console.warn("Fetching all current trips due to missing Firebase index. Add '.indexOn': 'driverId' to 'currentTrips' rules for better performance.");
  
  const tripsRef = ref(database, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef); // Fetch all trips under CURRENT_TRIPS_PATH

  if (snapshot.exists()) {
    let activeTrip: Trip | null = null;
    snapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      if (trip.driverId === driverId && (trip.status === 'upcoming' || trip.status === 'ongoing')) {
        activeTrip = trip;
        return true; // Break loop (forEach doesn't truly break, but this is a common pattern)
      }
    });
    return activeTrip;
  }
  return null;
};

export const getUpcomingAndOngoingTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  // WORKAROUND for missing Firebase index on 'driverId' in 'currentTrips'.
  // This fetches ALL current trips and filters client-side.
  // THIS IS INEFFICIENT FOR LARGE DATASETS.
  // The proper fix is to add ".indexOn": "driverId" to your Firebase Realtime Database rules for the 'currentTrips' path.
  console.warn("Fetching all current trips due to missing Firebase index. Add '.indexOn': 'driverId' to 'currentTrips' rules for better performance.");

  const tripsRef = ref(database, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef); // Fetch all trips
  const trips: Trip[] = [];

  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      if (trip.driverId === driverId && (trip.status === 'upcoming' || trip.status === 'ongoing')) {
        trips.push(trip);
      }
    });
  }
  return trips.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
};

export const getCompletedTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  // NOTE: If you query finishedTrips by driverId frequently, you should also add
  // ".indexOn": "driverId" to your Firebase rules for the 'finishedTrips/{driverId}' path,
  // or structure 'finishedTrips' so that driverId is a top-level key.
  // Current implementation fetches all trips for a specific driver under 'finishedTrips/{driverId}'.
  const tripsRef = ref(database, `${FINISHED_TRIPS_PATH}/${driverId}`);
  const snapshot = await get(tripsRef);
  const trips: Trip[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      trips.push(childSnapshot.val() as Trip);
    });
  }
  // Sort by date, most recent first
  return trips.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
};

export const endTrip = async (trip: Trip): Promise<void> => {
  if (!trip || !trip.driverId || !trip.id) {
    throw new Error("Invalid trip data for ending trip.");
  }
  // 1. Calculate earnings (simplified)
  const earnings = (trip.selectedSeats?.length || 0) * trip.pricePerPassenger;

  // 2. Update trip status and earnings
  const updatedTripData: Partial<Trip> = {
    status: 'completed',
    earnings: earnings,
    updatedAt: serverTimestamp(),
  };
  
  const finishedTripRef = ref(database, `${FINISHED_TRIPS_PATH}/${trip.driverId}/${trip.id}`);
  const originalTripRef = ref(database, `${CURRENT_TRIPS_PATH}/${trip.id}`);

  const finalTripDataForFinished = { ...trip, ...updatedTripData };

  // Using a multi-path update to move and update atomically is safer if possible,
  // but for simplicity, we'll set to new location and remove from old.
  await set(finishedTripRef, finalTripDataForFinished);
  await remove(originalTripRef);

  // Potentially update driver's total trips/earnings in their profile (complex, skipped for now)
};

// Legacy functions from storage.ts that might be called by components
// These should be deprecated in favor of direct Firebase calls or specific service functions
export const getTrips = async (): Promise<Trip[]> => {
  // This function is problematic without a driverId.
  // Assuming it's for a generic "all current trips" view (not typical for driver app)
  // or needs refactoring to accept driverId.
  // For now, let's assume it fetches ALL current trips.
  // This is NOT what the driver app usually needs for "my trips".
  const tripsRef = ref(database, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef);
  const trips: Trip[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      trips.push(childSnapshot.val() as Trip);
    });
  }
  return trips;
};


// --- Utility to simulate Cloudinary URL ---
// Replace with actual Cloudinary upload logic in a real app (likely via backend)
export const simulateCloudinaryUpload = (fileName: string = "sample.jpg"): string => {
  const cloudName = "dorbgzcrz"; // Your Cloudinary cloud name
  // Simulate a version and public ID for variety, or use a fixed one
  const version = `v${Date.now().toString().slice(0, 10)}`;
  const publicId = fileName.split('.')[0] + '_' + Math.random().toString(36).substring(2, 8);
  // return `https://res.cloudinary.com/${cloudName}/image/upload/${version}/${publicId}.${fileName.split('.').pop()}`;
  return `https://placehold.co/300x200.png?text=${encodeURIComponent(fileName)}`; // Simpler placeholder
};

