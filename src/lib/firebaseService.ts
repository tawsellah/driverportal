
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
  walletBalance?: number; 
  createdAt: any; 
}

export interface Trip {
  id: string; 
  driverId: string; 
  startPoint: string; 
  stops?: string[]; 
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
    walletBalance: profileData.walletBalance || 0, 
    createdAt: serverTimestamp(),
  };
  await set(userRef, fullProfileData);
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    const profile = snapshot.val() as UserProfile;
    
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
  value: number; // The monetary value of the code
  usesLeft: number; // How many times this code can be used
  isActive: boolean; // Whether the code is generally active
}

export const chargeWalletWithCode = async (
  userId: string,
  chargeCodeInput: string
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  if (!userId || !chargeCodeInput) {
    return { success: false, message: "معرف المستخدم أو كود الشحن مفقود." };
  }

  const userProfileRef = ref(databaseInternal, `users/${userId}`);
  const chargeCodeRef = ref(databaseInternal, `admin_charge_codes/${chargeCodeInput}`);

  try {
    // Step 1: Perform a transaction on the charge code to ensure atomic "usage"
    const transactionResult = await runTransaction(chargeCodeRef, (currentCodeData: ChargeCode | null) => {
      if (currentCodeData === null) {
        // Code does not exist in admin_charge_codes
        return; // Abort transaction, indicating code is invalid
      }
      if (!currentCodeData.isActive || currentCodeData.usesLeft <= 0) {
        // Code is not active or has no uses left
        return; // Abort transaction, indicating code is invalid
      }
      
      // If valid, "use" the code by decrementing usesLeft and updating isActive
      currentCodeData.usesLeft -= 1;
      currentCodeData.isActive = currentCodeData.usesLeft > 0;
      return currentCodeData; // Return the modified data to commit the transaction
    });

    // Step 2: Process the outcome of the transaction
    if (transactionResult.committed && transactionResult.snapshot.exists()) {
      // The transaction was successful, and the charge code was "spent" (or its uses decremented).
      const usedCodeData = transactionResult.snapshot.val() as ChargeCode;
      const chargeAmount = usedCodeData.value; // The monetary value of the code

      // Now, fetch the user's current profile to update their wallet balance.
      const userProfileSnapshot = await get(userProfileRef);
      if (!userProfileSnapshot.exists()) {
        // This is an unlikely scenario if userId is correct, but a critical safeguard.
        // If the user profile doesn't exist, we can't update the balance.
        // The charge code has already been "spent". This situation might require manual intervention or more complex rollback logic (ideally via Cloud Functions).
        console.error(`User profile for userId ${userId} not found after successfully committing charge code ${chargeCodeInput}. Code usage was recorded.`);
        return { 
          success: false, 
          message: "تم استخدام الكود بنجاح، ولكن حدث خطأ أثناء تحديث رصيد المستخدم. يرجى التواصل مع الدعم." 
        };
      }
      
      let userProfile = userProfileSnapshot.val() as UserProfile;
      const currentBalance = userProfile.walletBalance || 0;
      const newBalance = currentBalance + chargeAmount;
      
      await update(userProfileRef, { walletBalance: newBalance });

      return {
        success: true,
        message: `تم شحن الرصيد بنجاح بقيمة ${chargeAmount.toFixed(2)} د.أ. الرصيد الجديد: ${newBalance.toFixed(2)} د.أ.`,
        newBalance: newBalance,
      };
    } else {
      // The transaction was aborted. This means the code was invalid (e.g., didn't exist, was inactive, or had no uses left at the time of the transaction).
      // For a more specific message, we can re-fetch the current state of the code (optional, as the transaction already determined invalidity).
      const currentCodeSnapshot = await get(chargeCodeRef);
      if (!currentCodeSnapshot.exists()) {
        return { success: false, message: "كود الشحن غير صالح أو غير موجود." };
      }
      const codeData = currentCodeSnapshot.val() as ChargeCode; // Check its state
      if (!codeData.isActive || codeData.usesLeft <= 0) {
        return { success: false, message: "كود الشحن غير فعال أو تم استخدامه بالكامل." };
      }
      // Fallback for other transaction abortion reasons
      return { success: false, message: "فشل التحقق من كود الشحن أو استخدامه."};
    }

  } catch (error) {
    console.error("Error during chargeWalletWithCode operation:", error);
    // This could be a network error or other unexpected issue.
    return { success: false, message: "حدث خطأ أثناء عملية شحن الرصيد. يرجى المحاولة مرة أخرى." };
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

export const startTrip = async (tripId: string): Promise<void> => {
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const snapshot = await get(tripRef);
  if (snapshot.exists()) {
    const trip = snapshot.val() as Trip;
    if (trip.status === 'upcoming') {
      await update(tripRef, { status: 'ongoing', updatedAt: serverTimestamp() });
    } else {
      // This error will be caught by the calling function and can be shown in a toast
      console.error("Trip is not upcoming and cannot be started. Current status:", trip.status);
      throw new Error("الرحلة ليست قادمة ولا يمكن بدؤها.");
    }
  } else {
    console.error("Trip not found for starting:", tripId);
    throw new Error("لم يتم العثور على الرحلة لبدءها.");
  }
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
      
      const finishedTripData: Trip = {
        ...tripToEnd,
        ...updates,
      };
      const finishedTripRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${tripToEnd.driverId}/${tripToEnd.id}`);
      await set(finishedTripRef, finishedTripData);
      await remove(tripRef); 
    }
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
    const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
    const snapshot = await get(tripRef);
    if (snapshot.exists()) {
        return snapshot.val() as Trip;
    }
    
    const finishedTripsSnapshot = await get(ref(databaseInternal, FINISHED_TRIPS_PATH));
    if(finishedTripsSnapshot.exists()){
        let foundTrip: Trip | null = null;
        finishedTripsSnapshot.forEach((driverNode) => {
            const driverTrips = driverNode.val();
            if(driverTrips[tripId]){
                foundTrip = driverTrips[tripId] as Trip;
                return true; 
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
    if (Array.isArray(stopsData)) {
      return stopsData.filter(stop => typeof stop === 'string' && stop.trim() !== '');
    } else if (typeof stopsData === 'object' && stopsData !== null) {
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
    await set(routeStopsRef, null); 
    await set(routeLastUpdatedRef, serverTimestamp());
    console.log(`All stops for route ${routeKey} cleared.`);
  }
};

    

