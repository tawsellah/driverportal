
"use client";

import { auth as authInternal , database as databaseInternal } from './firebase'; // Renamed to avoid conflict with exported auth
import { 
  onAuthStateChanged,
  type User as FirebaseAuthUser 
} from 'firebase/auth';
import { ref, set, get, child, update, remove, query, orderByChild, equalTo, serverTimestamp } from 'firebase/database';
import type { SeatID } from './constants';
import { SEAT_CONFIG } from './constants'; // Import SEAT_CONFIG

// Re-export auth from firebase for direct use if needed elsewhere, or components can import from here
export const auth = authInternal;
export const database = databaseInternal;


// User Profile Interface
export interface UserProfile {
  id: string; 
  fullName: string;
  email: string; 
  phone: string; 
  idNumber?: string;
  idPhotoUrl?: string | null; 
  licenseNumber?: string;
  licenseExpiry?: string;
  licensePhotoUrl?: string | null; 
  vehicleType?: string;
  vehicleMakeModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  vehiclePlateNumber?: string;
  vehiclePhotosUrl?: string | null;
  rating?: number;
  tripsCount?: number;
  paymentMethods?: {
    click?: boolean;
    cash?: boolean;
    clickCode?: string;
  };
  createdAt: any; 
}

// Trip Interface
export interface Trip {
  id: string; 
  driverId: string; 
  startPoint: string; 
  stops?: string[]; 
  destination: string; 
  dateTime: string; 
  expectedArrivalTime: string; 
  // offeredSeatIds: SeatID[]; // Removed
  offeredSeatsConfig: Record<string, boolean>; // Added: e.g., { front_passenger: true, back_right: false }
  selectedSeats: SeatID[];
  meetingPoint: string;
  pricePerPassenger: number;
  notes?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  earnings?: number;
  passengers?: any[]; 
  createdAt: any; 
  updatedAt?: any; 
}

export type NewTripData = Omit<Trip, 'id' | 'status' | 'selectedSeats' | 'passengers' | 'earnings' | 'driverId' | 'createdAt' | 'updatedAt'>;

// --- Auth Service ---
export const getCurrentUser = (): FirebaseAuthUser | null => {
  return authInternal.currentUser;
};

export const onAuthUserChangedListener = (callback: (user: FirebaseAuthUser | null) => void) => {
  return onAuthStateChanged(authInternal, callback);
};


// --- User Profile Service ---
export const saveUserProfile = async (userId: string, profileData: Omit<UserProfile, 'id' | 'createdAt'>): Promise<void> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  const fullProfileData: UserProfile = {
    id: userId,
    ...profileData,
    createdAt: serverTimestamp(),
  };
  await set(userRef, fullProfileData);
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    return snapshot.val() as UserProfile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  await update(userRef, updates);
};


// --- Trip Service ---
const CURRENT_TRIPS_PATH = 'currentTrips';
const FINISHED_TRIPS_PATH = 'finishedTrips';

export const addTrip = async (driverId: string, tripData: NewTripData): Promise<Trip> => {
  const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newTrip: Trip = {
    ...tripData, // This now includes offeredSeatsConfig
    id: tripId,
    driverId,
    status: 'upcoming',
    selectedSeats: [],
    passengers: [],
    createdAt: serverTimestamp(),
  };
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  await set(tripRef, newTrip);
  return newTrip;
};

export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const updateData = { ...updates, updatedAt: serverTimestamp() }; // updates might include offeredSeatsConfig
  await update(tripRef, updateData);
};

export const deleteTrip = async (tripId: string): Promise<void> => {
  // This should ideally fetch the trip to get driverId for finishedTrips path, or change status and move later.
  // For simplicity, just updating status. A more robust "cancel" might move it to finishedTrips with "cancelled" status.
  await updateTrip(tripId, { status: 'cancelled', updatedAt: serverTimestamp() });
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
    const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
    const snapshot = await get(tripRef);
    if (snapshot.exists()) {
        return snapshot.val() as Trip;
    }
    // Optionally, check finishedTrips if a trip could be there
    // const finishedSnapshot = await get(ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${tripId}`)); // This assumes tripId is unique across both
    // if (finishedSnapshot.exists()) {
    //     return finishedSnapshot.val() as Trip;
    // }
    return null;
};


export const getActiveTripForDriver = async (driverId: string): Promise<Trip | null> => {
  console.warn("[WORKAROUND] Fetching all current trips and filtering client-side due to missing Firebase index. Add '.indexOn': 'driverId' to 'currentTrips' rules for better performance.");
  
  const tripsRef = ref(databaseInternal, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef); 

  if (snapshot.exists()) {
    let activeTrip: Trip | null = null;
    snapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      if (trip.driverId === driverId && (trip.status === 'upcoming' || trip.status === 'ongoing')) {
        activeTrip = trip;
        return true; 
      }
    });
    return activeTrip;
  }
  return null;
};

export const getUpcomingAndOngoingTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  console.warn("[WORKAROUND] Fetching all current trips and filtering client-side due to missing Firebase index. Add '.indexOn': ['driverId', 'status'] to 'currentTrips' rules for better performance.");

  const tripsRef = ref(databaseInternal, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef); 
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
  const tripsRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${driverId}`);
  const snapshot = await get(tripsRef);
  const trips: Trip[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      trips.push(childSnapshot.val() as Trip);
    });
  }
  return trips.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
};

export const endTrip = async (trip: Trip): Promise<void> => {
  if (!trip || !trip.driverId || !trip.id) {
    console.error("Invalid trip data for ending trip:", trip);
    throw new Error("Invalid trip data for ending trip.");
  }
  const earnings = (trip.selectedSeats?.length || 0) * trip.pricePerPassenger;
  
  const finishedTripData: Trip = {
    ...trip,
    status: 'completed',
    earnings: earnings,
    updatedAt: serverTimestamp(),
  };
  
  const finishedTripRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${trip.driverId}/${trip.id}`);
  const originalTripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${trip.id}`);

  await set(finishedTripRef, finishedTripData);
  await remove(originalTripRef);

  const userProfileRef = ref(databaseInternal, `users/${trip.driverId}`);
  const userProfileSnap = await get(userProfileRef);
  if (userProfileSnap.exists()) {
      const currentTripsCount = userProfileSnap.val().tripsCount || 0;
      await update(userProfileRef, { tripsCount: currentTripsCount + 1 });
  }
};

export const getTrips = async (): Promise<Trip[]> => {
  const tripsRef = ref(databaseInternal, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef);
  const trips: Trip[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      trips.push(childSnapshot.val() as Trip);
    });
  }
  return trips;
};
