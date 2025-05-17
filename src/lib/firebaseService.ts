
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
  idPhotoUrl?: string | null; // Simulated ImageKit URL
  licenseNumber?: string;
  licenseExpiry?: string;
  licensePhotoUrl?: string | null; // Simulated ImageKit URL
  vehicleType?: string;
  vehicleMakeModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  vehiclePlateNumber?: string;
  vehiclePhotosUrl?: string | null; // Simulated ImageKit URL
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
  console.warn("[WORKAROUND] Fetching all current trips and filtering client-side due to missing Firebase index. Add '.indexOn': 'driverId' to 'currentTrips' rules for better performance.");
  
  const tripsRef = ref(database, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef); 

  if (snapshot.exists()) {
    let activeTrip: Trip | null = null;
    snapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      if (trip.driverId === driverId && (trip.status === 'upcoming' || trip.status === 'ongoing')) {
        activeTrip = trip;
        // @ts-ignore allow forEach break
        return true; 
      }
    });
    return activeTrip;
  }
  return null;
};

export const getUpcomingAndOngoingTripsForDriver = async (driverId: string): Promise<Trip[]> => {
   console.warn("[WORKAROUND] Fetching all current trips and filtering client-side due to missing Firebase index. Add '.indexOn': ['driverId', 'status'] to 'currentTrips' rules for better performance.");

  const tripsRef = ref(database, CURRENT_TRIPS_PATH);
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
  const tripsRef = ref(database, `${FINISHED_TRIPS_PATH}/${driverId}`);
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
    throw new Error("Invalid trip data for ending trip.");
  }
  const earnings = (trip.selectedSeats?.length || 0) * trip.pricePerPassenger;
  const updatedTripData: Partial<Trip> = {
    status: 'completed',
    earnings: earnings,
    updatedAt: serverTimestamp(),
  };
  
  const finishedTripRef = ref(database, `${FINISHED_TRIPS_PATH}/${trip.driverId}/${trip.id}`);
  const originalTripRef = ref(database, `${CURRENT_TRIPS_PATH}/${trip.id}`);
  const finalTripDataForFinished = { ...trip, ...updatedTripData };

  await set(finishedTripRef, finalTripDataForFinished);
  await remove(originalTripRef);
};

export const getTrips = async (): Promise<Trip[]> => {
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

/**
 * [AR] محاكاة لعملية رفع صورة إلى ImageKit. هذه الدالة **لا تقوم برفع فعلي للملفات**.
 * بدلاً من ذلك، هي تنشئ رابط URL وهمي بناءً على اسم الملف المدخل،
 * ليتم حفظه في Firebase Realtime Database كأنه رابط صورة حقيقي من ImageKit.
 * في تطبيق حقيقي، ستحتاج إلى استخدام ImageKit SDK وربما خادم وسيط لرفع الملفات بأمان.
 * يتم استخدام معرّف ImageKit الخاص بالمستخدم (Tawsellah) هنا.
 * @param fileName اسم الملف المراد "رفعه" (مثل "my-image.jpg").
 * @returns رابط URL مُحاكى لـ ImageKit.
 */
export const simulateImageKitUpload = (fileName: string = "sample.jpg"): string => {
  const imageKitId = "Tawsellah"; // User's ImageKit ID from their URL Endpoint
  const uploadFolder = "uploads"; // You can change this if you use a different folder structure in ImageKit

  // Extract filename without extension for public_id
  const nameParts = fileName.split('.');
  const extension = nameParts.pop() || 'jpg'; // Default to jpg if no extension
  const baseName = nameParts.join('.').replace(/[^a-zA-Z0-9_.-]/g, '_'); // Sanitize basename

  // Create a unique-ish filename by appending a short random string and timestamp component.
  const uniqueFileName = `${baseName}_${Math.random().toString(36).substring(2, 7)}_${Date.now()}`;
  
  // Construct the URL based on the ImageKit endpoint structure
  const generatedUrl = `https://ik.imagekit.io/${imageKitId}/${uploadFolder}/${uniqueFileName}.${extension}`;
  console.log(`[SIMULATE IMAGEKIT UPLOAD] Generated URL for ${fileName} using ImageKit ID '${imageKitId}': ${generatedUrl}`);
  return generatedUrl;
};

// For backward compatibility if any component still uses it, though it should be updated
export const simulateCloudinaryUpload = simulateImageKitUpload;
