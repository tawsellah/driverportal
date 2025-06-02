
"use client";

import { auth as authInternal , database as databaseInternal } from './firebase'; 
import { 
  onAuthStateChanged,
  type User as FirebaseAuthUser 
} from 'firebase/auth';
import { ref, set, get, child, update, remove, query, orderByChild, equalTo, serverTimestamp, runTransaction } from 'firebase/database';
import type { SeatID } from './constants';
import { SEAT_CONFIG } from './constants'; 

export const auth = authInternal;
export const database = databaseInternal;

export interface PassengerBookingDetails {
  userId: string;
  phone: string;
  fullName: string; // Passenger's full name is now directly in booking details
  bookedAt: any; 
}

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
  walletBalance?: number; // Added wallet balance
  createdAt: any; 
}

export interface Trip {
  id: string; 
  driverId: string; 
  startPoint: string; 
  stops?: string[]; // Stops are now free text
  destination: string; 
  dateTime: string; 
  expectedArrivalTime: string; 
  offeredSeatsConfig: Record<string, boolean | PassengerBookingDetails>; 
  meetingPoint: string;
  pricePerPassenger: number;
  notes?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  earnings?: number;
  createdAt: any; 
  updatedAt?: any; 
}

export type NewTripData = Omit<Trip, 'id' | 'status' | 'earnings' | 'driverId' | 'createdAt' | 'updatedAt'>;

// --- Auth Service ---
export const getCurrentUser = (): FirebaseAuthUser | null => {
  return authInternal.currentUser;
};

export const onAuthUserChangedListener = (callback: (user: FirebaseAuthUser | null) => void) => {
  return onAuthStateChanged(authInternal, callback);
};


// --- User Profile Service ---
export const saveUserProfile = async (userId: string, profileData: Omit<UserProfile, 'id' | 'createdAt' >): Promise<void> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  const fullProfileData: UserProfile = {
    id: userId,
    ...profileData,
    walletBalance: profileData.walletBalance || 0, // Initialize wallet balance
    createdAt: serverTimestamp(),
  };
  await set(userRef, fullProfileData);
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    const profile = snapshot.val() as UserProfile;
    // Ensure walletBalance has a default value if not present
    if (profile.walletBalance === undefined || profile.walletBalance === null) {
        profile.walletBalance = 0;
    }
    return profile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  await update(userRef, updates);
};

// --- Wallet Service (Charge Code Logic) ---
interface ChargeCode {
  value: number;
  usesLeft: number;
  isActive: boolean;
}

/**
 * IMPORTANT SECURITY WARNING:
 * This function implements charge code validation and wallet balance updates directly
 * from the client-side. This is EXTREMELY INSECURE for a production application.
 * Anyone can inspect the client-side code, understand how codes are validated,
 * and potentially abuse the system to add funds to their wallet or reuse codes.
 *
 * In a real application, this ENTIRE LOGIC (code validation, fetching user balance,
 * updating balance, and marking code as used) MUST be handled by a secure
 * Firebase Cloud Function (or a similar backend service). The client should only
 * send the chargeCode and userId to the Cloud Function, and the Cloud Function
 * would perform all sensitive operations.
 */
export const chargeWalletWithCode = async (
  userId: string,
  chargeCodeInput: string
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  if (!userId || !chargeCodeInput) {
    return { success: false, message: "معرف المستخدم أو كود الشحن مفقود." };
  }

  const chargeCodeRef = ref(databaseInternal, `admin_charge_codes/${chargeCodeInput}`);
  const userProfileRef = ref(databaseInternal, `users/${userId}`);

  try {
    const result = await runTransaction(userProfileRef, (currentProfileData: UserProfile | null) => {
      if (currentProfileData === null) {
        // User profile doesn't exist, abort transaction
        // This case should ideally not happen if user is logged in
        return; // Aborts the transaction
      }

      // We need to fetch the charge code data within the transaction as well,
      // or rather, the secure way is for a Cloud Function to do this.
      // For this client-side mock, we'll fetch it outside and pass its effect.
      // This is still part of the insecure mock.
      return currentProfileData; // Placeholder, actual logic below
    });

    if (!result.committed || !result.snapshot.exists()) {
       // Transaction aborted or profile doesn't exist (should be caught by initial check in a real scenario)
       // For the mock, if the profile was null, the transaction would abort.
       // Let's refine the mock:
       const userProfileSnapshot = await get(userProfileRef);
       if (!userProfileSnapshot.exists()) {
         return { success: false, message: "لم يتم العثور على ملف المستخدم." };
       }
       let userProfile = userProfileSnapshot.val() as UserProfile;
       userProfile.walletBalance = userProfile.walletBalance || 0;


       const codeSnapshot = await get(chargeCodeRef);
       if (!codeSnapshot.exists()) {
         return { success: false, message: "كود الشحن غير صالح." };
       }
       const codeData = codeSnapshot.val() as ChargeCode;

       if (!codeData.isActive || codeData.usesLeft <= 0) {
         return { success: false, message: "كود الشحن غير فعال أو تم استخدامه بالكامل." };
       }

       // If we were in a real transaction, we'd update usesLeft and walletBalance atomically.
       // Mocking the update:
       const newBalance = (userProfile.walletBalance || 0) + codeData.value;
       
       // Update user's wallet balance
       await update(userProfileRef, { walletBalance: newBalance });
       
       // Update charge code (decrement usesLeft or set isActive to false)
       await update(chargeCodeRef, { usesLeft: codeData.usesLeft - 1, isActive: (codeData.usesLeft - 1 > 0) });

       return {
         success: true,
         message: `تم شحن الرصيد بنجاح بقيمة ${codeData.value} د.أ. الرصيد الجديد: ${newBalance.toFixed(2)} د.أ.`,
         newBalance: newBalance,
       };

    } else {
      // This block would be for when the transaction successfully committed `currentProfileData`.
      // However, the critical part (code validation & update) is mocked outside.
      // This else block is unlikely to be hit correctly in this mocked setup.
      // The primary logic is in the "refined mock" above.
      return { success: false, message: "حدث خطأ غير متوقع أثناء محاولة شحن الرصيد." };
    }

  } catch (error) {
    console.error("Error charging wallet:", error);
    return { success: false, message: "فشل شحن الرصيد. الرجاء المحاولة مرة أخرى." };
  }
};


// --- Trip Service ---
const CURRENT_TRIPS_PATH = 'currentTrips';
const FINISHED_TRIPS_PATH = 'finishedTrips';
const STOP_STATIONS_PATH = 'stopstations';


export const addTrip = async (driverId: string, tripData: NewTripData): Promise<Trip> => {
  const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newTrip: Trip = {
    ...tripData, 
    id: tripId,
    driverId,
    status: 'upcoming',
    createdAt: serverTimestamp(),
  };
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  await set(tripRef, newTrip);
  return newTrip;
};

export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const updateData = { ...updates, updatedAt: serverTimestamp() }; 
  await update(tripRef, updateData);
};

export const deleteTrip = async (tripId: string): Promise<void> => {
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const snapshot = await get(tripRef);
  if (snapshot.exists()) {
    const tripToEnd = snapshot.val() as Trip;
     if (tripToEnd.status === 'upcoming' || tripToEnd.status === 'ongoing') {
      const updates: Partial<Trip> = { status: 'cancelled', updatedAt: serverTimestamp() };
      

      // Move to finishedTrips
      const finishedTripData: Trip = {
        ...tripToEnd,
        ...updates,
      };
      const finishedTripRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${tripToEnd.driverId}/${tripToEnd.id}`);
      await set(finishedTripRef, finishedTripData);
      await remove(tripRef); // Remove from currentTrips
    }
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
    const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
    const snapshot = await get(tripRef);
    if (snapshot.exists()) {
        return snapshot.val() as Trip;
    }
    // Also check finishedTrips if not found in currentTrips (e.g., for history page access)
    const finishedTripsSnapshot = await get(ref(databaseInternal, FINISHED_TRIPS_PATH));
    if(finishedTripsSnapshot.exists()){
        let foundTrip: Trip | null = null;
        finishedTripsSnapshot.forEach((driverNode) => {
            const driverTrips = driverNode.val();
            if(driverTrips[tripId]){
                foundTrip = driverTrips[tripId] as Trip;
                return true; // break forEach
            }
        });
        if(foundTrip) return foundTrip;
    }
    return null;
};


export const getActiveTripForDriver = async (driverId: string): Promise<Trip | null> => {
  console.warn("[WORKAROUND] Fetching all current trips and filtering client-side due to missing Firebase index. Add '.indexOn': ['driverId', 'status'] to 'currentTrips' rules for better performance.");
  
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

export const endTrip = async (tripToEnd: Trip, earnings: number): Promise<void> => {
  if (!tripToEnd || !tripToEnd.driverId || !tripToEnd.id) {
    console.error("Invalid trip data for ending trip:", tripToEnd);
    throw new Error("Invalid trip data for ending trip.");
  }
  
  const finishedTripData: Trip = {
    ...tripToEnd,
    status: 'completed',
    earnings: earnings,
    updatedAt: serverTimestamp(),
  };
  
  const finishedTripRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${tripToEnd.driverId}/${tripToEnd.id}`);
  const originalTripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripToEnd.id}`);

  await set(finishedTripRef, finishedTripData);
  await remove(originalTripRef);

  const userProfileRef = ref(databaseInternal, `users/${tripToEnd.driverId}`);
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

// --- Stop Stations Service ---
export const generateRouteKey = (startPointId: string, destinationId: string): string => {
  return `${startPointId.toLowerCase()}_to_${destinationId.toLowerCase()}`;
};

export const getStopStationsForRoute = async (startPointId: string, destinationId: string): Promise<string[] | null> => {
  if (!startPointId || !destinationId) return null;
  const routeKey = generateRouteKey(startPointId, destinationId);
  const routeRef = ref(databaseInternal, `${STOP_STATIONS_PATH}/${routeKey}/stops`);
  const snapshot = await get(routeRef);
  if (snapshot.exists()) {
    const stopsData = snapshot.val();
    // Ensure stopsData is an array, handle cases where it might be an object if previously saved incorrectly
    if (Array.isArray(stopsData)) {
      return stopsData.filter(stop => typeof stop === 'string' && stop.trim() !== '');
    } else if (typeof stopsData === 'object' && stopsData !== null) {
      // Fallback for old data structure if stops were like {0: "stop1", 1: "stop2"}
      return Object.values(stopsData).filter(stop => typeof stop === 'string' && (stop as string).trim() !== '') as string[];
    }
  }
  return null;
};

export const addStopsToRoute = async (startPointId: string, destinationId: string, newStops: string[]): Promise<void> => {
  if (!startPointId || !destinationId) return;
  const routeKey = generateRouteKey(startPointId, destinationId);
  const routeStopsRef = ref(databaseInternal, `${STOP_STATIONS_PATH}/${routeKey}/stops`);
  const routeLastUpdatedRef = ref(databaseInternal, `${STOP_STATIONS_PATH}/${routeKey}/lastUpdated`);

  // Filter out any empty or non-string stops from input
  const validNewStops = newStops.filter(stop => typeof stop === 'string' && stop.trim() !== '');

  const snapshot = await get(routeStopsRef);
  let existingStops: string[] = [];
  if (snapshot.exists()) {
    const stopsData = snapshot.val();
    if (Array.isArray(stopsData)) {
        existingStops = stopsData.filter(stop => typeof stop === 'string' && stop.trim() !== '');
    } else if (typeof stopsData === 'object' && stopsData !== null) {
        existingStops = Object.values(stopsData).filter(stop => typeof stop === 'string' && (stop as string).trim() !== '') as string[];
    }
  }

  const combinedStops = new Set([...existingStops, ...validNewStops]);
  const uniqueStopsArray = Array.from(combinedStops);

  if (uniqueStopsArray.length > 0) {
    await set(routeStopsRef, uniqueStopsArray);
    await set(routeLastUpdatedRef, serverTimestamp());
    console.log(`Stops for route ${routeKey} updated:`, uniqueStopsArray);
  } else if (existingStops.length > 0 && uniqueStopsArray.length === 0) {
    // If all stops were removed, clear them from DB
    await set(routeStopsRef, null); 
    await set(routeLastUpdatedRef, serverTimestamp());
    console.log(`All stops for route ${routeKey} cleared.`);
  }
};

    
