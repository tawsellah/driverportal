
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
  fullName: string; 
  bookedAt: any; 
}

export interface UserProfileTopUpCode {
  code: string;
  amount: number;
  status: 'unused' | 'used';
  createdAt: any; // Or number for timestamp
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
  vehiclePhotosUrl?: string | null; // Note: was vehiclePhotoUrl in signup, should be consistent or mapped
  rating?: number;
  tripsCount?: number;
  paymentMethods?: {
    click?: boolean;
    cash?: boolean;
    clickCode?: string;
  };
  walletBalance?: number; 
  topUpCodes?: Record<string, UserProfileTopUpCode>; // Key is an auto-generated ID for the code entry
  createdAt: any; 
  updatedAt?: any;
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
export const saveUserProfile = async (userId: string, profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' >): Promise<void> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  const fullProfileData: UserProfile = {
    id: userId,
    ...profileData,
    walletBalance: profileData.walletBalance || 0, 
    topUpCodes: profileData.topUpCodes || {},
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
    if (!profile.topUpCodes) {
        profile.topUpCodes = {};
    }
    return profile;
  }
  return null;
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  const userRef = ref(databaseInternal, `users/${userId}`);
  await update(userRef, {...updates, updatedAt: serverTimestamp()});
};

// --- Wallet Service (Charge Code Logic) ---

export const chargeWalletWithCode = async (
  userId: string,
  chargeCodeInputOriginal: string
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  if (!userId || !chargeCodeInputOriginal) {
    return { success: false, message: "معرف المستخدم أو كود الشحن مفقود." };
  }

  const chargeCodeInput = chargeCodeInputOriginal.trim().toLowerCase();
  if (!chargeCodeInput) {
    return { success: false, message: "الرجاء إدخال كود الشحن." };
  }

  const userProfileRef = ref(databaseInternal, `users/${userId}`);

  try {
    const transactionResult = await runTransaction(userProfileRef, (currentProfileData: UserProfile | null) => {
      if (currentProfileData === null) {
        throw new Error("USER_PROFILE_NOT_FOUND");
      }

      if (!currentProfileData.topUpCodes || Object.keys(currentProfileData.topUpCodes).length === 0) {
        throw new Error("NO_CODES_FOR_ACCOUNT");
      }

      let foundCodeDetails: { entryId: string, data: UserProfileTopUpCode } | null = null;
      let codeEntryIdToUpdate: string | null = null;

      for (const entryId in currentProfileData.topUpCodes) {
        const codeDetail = currentProfileData.topUpCodes[entryId];
        if (codeDetail.code && codeDetail.code.trim().toLowerCase() === chargeCodeInput) {
          foundCodeDetails = { entryId, data: codeDetail };
          codeEntryIdToUpdate = entryId;
          break;
        }
      }

      if (!foundCodeDetails || !codeEntryIdToUpdate) {
        throw new Error("INVALID_CODE");
      }

      if (foundCodeDetails.data.status === 'used') {
        throw new Error("USED_CODE");
      }

      // Code is valid and unused
      const chargeAmount = foundCodeDetails.data.amount;
      currentProfileData.walletBalance = (currentProfileData.walletBalance || 0) + chargeAmount;
      
      // Update the status of the specific code entry
      currentProfileData.topUpCodes[codeEntryIdToUpdate].status = 'used';
      currentProfileData.updatedAt = serverTimestamp(); // Update timestamp for the profile

      return currentProfileData; // This is the data to be written
    });

    if (transactionResult.committed && transactionResult.snapshot.exists()) {
      const updatedProfile = transactionResult.snapshot.val() as UserProfile;
      
      let chargedAmount = 0;
      if(updatedProfile.topUpCodes){
        const usedCodeEntry = Object.values(updatedProfile.topUpCodes).find(
          (codeDetail) => codeDetail.code.trim().toLowerCase() === chargeCodeInput && codeDetail.status === 'used'
        );
        if(usedCodeEntry) {
            chargedAmount = usedCodeEntry.amount;
        }
      }

      return {
        success: true,
        message: `تم شحن الرصيد بنجاح بقيمة ${chargedAmount.toFixed(2)} د.أ. الرصيد الجديد: ${(updatedProfile.walletBalance || 0).toFixed(2)} د.أ.`,
        newBalance: updatedProfile.walletBalance,
      };
    } else {
      return { success: false, message: "فشلت عملية شحن الرصيد بسبب تنازع في البيانات أو خطأ غير متوقع. يرجى المحاولة مرة أخرى." };
    }

  } catch (error: any) {
    if (error.message === "USER_PROFILE_NOT_FOUND") {
      return { success: false, message: "لم يتم العثور على ملف المستخدم." };
    } else if (error.message === "NO_CODES_FOR_ACCOUNT") {
      return { success: false, message: "لا توجد أكواد شحن معرفة لهذا الحساب." };
    } else if (error.message === "INVALID_CODE") {
      return { success: false, message: "كود الشحن المدخل غير صالح." };
    } else if (error.message === "USED_CODE") {
      return { success: false, message: "تم استخدام هذا الكود مسبقًا." };
    }
    console.error("Error during chargeWalletWithCode transaction:", error);
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
    updatedAt: serverTimestamp(),
  };
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  await set(tripRef, newTrip);
  return newTrip;
};

export const startTrip = async (tripId: string): Promise<void> => {
  // Attempt to update in currentTrips first
  const currentTripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const currentSnapshot = await get(currentTripRef);

  if (currentSnapshot.exists()) {
    const trip = currentSnapshot.val() as Trip;
    if (trip.status === 'upcoming') {
      await update(currentTripRef, { status: 'ongoing', updatedAt: serverTimestamp() });
      return;
    } else {
      console.warn("Trip in currentTrips is not upcoming, status:", trip.status);
      // Potentially throw error or handle as needed if strict 'upcoming' start is required
    }
  }

  // If not found or not updated in currentTrips, check finishedTrips (for reactivated trips)
  // This assumes the tripId is globally unique and driverId is known or part of trip data if needed
  const finishedTripsSnapshot = await get(ref(databaseInternal, FINISHED_TRIPS_PATH));
  if (finishedTripsSnapshot.exists()) {
    let driverIdForTrip: string | null = null;
    let tripPathInFinished: string | null = null;
    let tripToReactivate: Trip | null = null;

    finishedTripsSnapshot.forEach(driverNode => {
      if (driverNode.hasChild(tripId)) {
        driverIdForTrip = driverNode.key;
        tripToReactivate = driverNode.child(tripId).val() as Trip;
        tripPathInFinished = `${FINISHED_TRIPS_PATH}/${driverIdForTrip}/${tripId}`;
        return true; // break loop
      }
    });

    if (tripToReactivate && driverIdForTrip && tripPathInFinished) {
      if (tripToReactivate.status === 'upcoming' || tripToReactivate.status === 'completed' || tripToReactivate.status === 'cancelled') { // Allow starting if it was upcoming, or "reactivating"
        const reactivatedTripData: Trip = {
          ...tripToReactivate,
          status: 'ongoing',
          updatedAt: serverTimestamp(),
        };
        // Move to currentTrips
        await set(ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`), reactivatedTripData);
        // Remove from finishedTrips
        await remove(ref(databaseInternal, tripPathInFinished));
        return;
      } else {
         console.error("Trip in finishedTrips cannot be started. Current status:", tripToReactivate.status);
         throw new Error("الرحلة في السجل ليست قادمة ولا يمكن بدؤها.");
      }
    }
  }
  
  // If trip was not found or couldn't be started in either location
  console.error("Trip not found or cannot be started:", tripId);
  throw new Error("لم يتم العثور على الرحلة أو لا يمكن بدؤها.");
};

export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
   const snapshot = await get(tripRef);
  if (snapshot.exists()) {
    await update(tripRef, { ...updates, updatedAt: serverTimestamp() });
  } else {
    // If not in currentTrips, check if it's a reactivated trip in finishedTrips that needs updating there
    // This scenario is less common for general updates but good for robustness
    const finishedTripsSnapshot = await get(ref(databaseInternal, FINISHED_TRIPS_PATH));
    if(finishedTripsSnapshot.exists()){
        let driverIdForTrip: string | null = null;
        let tripPathInFinished: string | null = null;
        finishedTripsSnapshot.forEach((driverNode) => {
            if (driverNode.hasChild(tripId)) {
                driverIdForTrip = driverNode.key;
                tripPathInFinished = `${FINISHED_TRIPS_PATH}/${driverIdForTrip}/${tripId}`;
                return true;
            }
        });
        if (tripPathInFinished) {
            await update(ref(databaseInternal, tripPathInFinished), { ...updates, updatedAt: serverTimestamp() });
            // If status is updated to 'upcoming' or 'ongoing', it should be moved. This is complex for a generic update.
            // For now, just update in place. Move logic is better handled in startTrip or a dedicated "reactivateTrip" function.
        } else {
            console.warn(`Trip ${tripId} not found for update.`);
        }
    }
  }
};

export const deleteTrip = async (tripId: string): Promise<void> => {
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const snapshot = await get(tripRef);
  if (snapshot.exists()) {
    const tripToEnd = snapshot.val() as Trip;
     if (tripToEnd.status === 'upcoming' || tripToEnd.status === 'ongoing') {
      const updates: Partial<Trip> = { status: 'cancelled', earnings: 0, updatedAt: serverTimestamp() };
      
      const finishedTripData: Trip = {
        ...tripToEnd,
        ...updates,
      };
      const finishedTripRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${tripToEnd.driverId}/${tripToEnd.id}`);
      await set(finishedTripRef, finishedTripData);
      await remove(tripRef); 
    } else {
      console.warn(`Trip ${tripId} in currentTrips is already completed or cancelled. Status: ${tripToEnd.status}`);
       if (tripToEnd.status === 'completed' || tripToEnd.status === 'cancelled') {
         await remove(tripRef);
       }
    }
  } else {
     console.warn(`Trip ${tripId} not found in currentTrips for deletion/cancellation.`);
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
    const currentTripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
    const currentSnapshot = await get(currentTripRef);
    if (currentSnapshot.exists()) {
        return currentSnapshot.val() as Trip;
    }
    
    // Search in finishedTrips if not found in currentTrips
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
  const activeAndUpcomingTrips = await getUpcomingAndOngoingTripsForDriver(driverId);

  if (activeAndUpcomingTrips.length === 0) {
    return null;
  }

  // Prioritize ongoing trip
  const ongoingTrip = activeAndUpcomingTrips.find(trip => trip.status === 'ongoing');
  if (ongoingTrip) {
    return ongoingTrip;
  }

  // If no ongoing, return the first upcoming trip (already sorted by dateTime)
  const upcomingTrip = activeAndUpcomingTrips.find(trip => trip.status === 'upcoming');
  return upcomingTrip || null;
};

export const getUpcomingAndOngoingTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  const allActiveTripsMap = new Map<string, Trip>();

  // 1. Fetch from currentTrips
  const currentTripsRef = ref(databaseInternal, CURRENT_TRIPS_PATH);
  const currentSnapshot = await get(currentTripsRef);
  if (currentSnapshot.exists()) {
    currentSnapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      if (trip.driverId === driverId && (trip.status === 'upcoming' || trip.status === 'ongoing')) {
        allActiveTripsMap.set(trip.id, trip);
      }
    });
  }

  // 2. Fetch from finishedTrips for the driver and check for reactivated trips
  const finishedDriverTripsRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${driverId}`);
  const finishedSnapshot = await get(finishedDriverTripsRef);
  if (finishedSnapshot.exists()) {
    finishedSnapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      // If a trip in finishedTrips is 'upcoming' or 'ongoing'
      if (trip.driverId === driverId && (trip.status === 'upcoming' || trip.status === 'ongoing')) {
        // Add to map. If it was already added from currentTrips, the one from currentTrips takes precedence.
        // However, for reactivated trips, it shouldn't be in currentTrips yet if only status was changed in finishedTrips.
        // This logic ensures it's included if it's "active" in finishedTrips.
        if (!allActiveTripsMap.has(trip.id)) {
            allActiveTripsMap.set(trip.id, trip);
        }
        // If an admin "reactivates" a trip by changing status in finishedTrips
        // AND moves it to currentTrips, this logic is fine.
        // If they ONLY change status in finishedTrips, this will pick it up.
      }
    });
  }

  const trips = Array.from(allActiveTripsMap.values());
  // Sort by dateTime in ascending order (earliest first)
  return trips.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
};


export const getCompletedTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  const tripsRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${driverId}`);
  const snapshot = await get(tripsRef); 
  const trips: Trip[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      // Only include if status is actually completed or cancelled
      if (trip.status === 'completed' || trip.status === 'cancelled') {
        trips.push(trip);
      }
    });
  }
  // Sort by updatedAt in descending order (most recent first) on the client-side
  return trips.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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

  // Use a transaction to update walletBalance and tripsCount together
  const userProfileRef = ref(databaseInternal, `users/${tripToEnd.driverId}`);
  const transactionResult = await runTransaction(userProfileRef, (currentProfile: UserProfile | null) => {
    if (currentProfile) {
      currentProfile.tripsCount = (currentProfile.tripsCount || 0) + 1;
      currentProfile.walletBalance = (currentProfile.walletBalance || 0) + earnings;
      currentProfile.updatedAt = serverTimestamp();
    }
    return currentProfile;
  });

  if (!transactionResult.committed) {
    console.error(`Failed to update user profile for driver ${tripToEnd.driverId} during endTrip.`);
    // Decide if you want to throw an error or proceed with moving the trip
    // For now, we'll proceed to move the trip even if profile update fails,
    // but this could lead to inconsistencies if not handled.
    // throw new Error("Failed to update driver's profile and wallet.");
  }
  
  await set(finishedTripRef, finishedTripData);
  await remove(originalTripRef);
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
  if (validNewStops.length === 0) return; 

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

  const combinedStopsSet = new Set(existingStops);
  validNewStops.forEach(stop => combinedStopsSet.add(stop));
  const uniqueStopsArray = Array.from(combinedStopsSet);

  await set(routeStopsRef, uniqueStopsArray);
  await set(routeLastUpdatedRef, serverTimestamp());
  console.log(`Stops for route ${routeKey} updated:`, uniqueStopsArray);
};

