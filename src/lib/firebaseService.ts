
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
      // This path might be hit if the transaction was aborted explicitly by returning undefined,
      // or if it failed after retries (e.g., due to contention or if the data becomes null and we didn't throw).
      // Given the specific error throws above, this is less likely for the known error conditions.
      return { success: false, message: "فشلت عملية شحن الرصيد بسبب تنازع في البيانات أو خطأ غير متوقع. يرجى المحاولة مرة أخرى." };
    }

  } catch (error: any) {
    // Handle errors explicitly thrown from inside the transaction
    if (error.message === "USER_PROFILE_NOT_FOUND") {
      return { success: false, message: "لم يتم العثور على ملف المستخدم." };
    } else if (error.message === "NO_CODES_FOR_ACCOUNT") {
      return { success: false, message: "لا توجد أكواد شحن معرفة لهذا الحساب." };
    } else if (error.message === "INVALID_CODE") {
      return { success: false, message: "كود الشحن المدخل غير صالح." };
    } else if (error.message === "USED_CODE") {
      return { success: false, message: "تم استخدام هذا الكود مسبقًا." };
    }
    // Generic error for other transaction failures or unexpected errors
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
  const tripRef = ref(databaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const snapshot = await get(tripRef);
  if (snapshot.exists()) {
    const trip = snapshot.val() as Trip;
    if (trip.status === 'upcoming') {
      await update(tripRef, { status: 'ongoing', updatedAt: serverTimestamp() });
    } else {
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
      const updates: Partial<Trip> = { status: 'cancelled', earnings: 0, updatedAt: serverTimestamp() };
      
      const finishedTripData: Trip = {
        ...tripToEnd,
        ...updates,
      };
      const finishedTripRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${tripToEnd.driverId}/${tripToEnd.id}`);
      await set(finishedTripRef, finishedTripData);
      await remove(tripRef); 
    } else {
      console.warn(`Trip ${tripId} is already completed or cancelled, cannot cancel again. Status: ${tripToEnd.status}`);
       if (tripToEnd.status === 'completed' || tripToEnd.status === 'cancelled') {
         // If it somehow exists in currentTrips but is already terminal, just remove it from currentTrips.
         // This might happen if the move to finishedTrips failed partially.
         await remove(tripRef);
       }
    }
  } else {
     console.warn(`Trip ${tripId} not found in currentTrips for deletion/cancellation.`);
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
  const tripsRef = ref(databaseInternal, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef); // Fetch all trips under CURRENT_TRIPS_PATH

  if (snapshot.exists()) {
    let ongoingTrip: Trip | null = null;
    let upcomingTrip: Trip | null = null;
    const now = new Date().getTime();

    snapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      if (trip.driverId === driverId) { // Filter by driverId on the client-side
          if (trip.status === 'ongoing') {
            // If multiple ongoing, pick the one that started most recently or based on dateTime.
            // For simplicity, let's assume only one ongoing per driver (or take the first found).
            if (!ongoingTrip || new Date(trip.dateTime).getTime() > new Date(ongoingTrip.dateTime).getTime()) {
                 ongoingTrip = trip;
            }
          } else if (trip.status === 'upcoming') {
            // If multiple upcoming, pick the one with the earliest dateTime that hasn't passed.
            const tripDateTime = new Date(trip.dateTime).getTime();
            if (tripDateTime >= now) { // Only consider truly upcoming trips
                if (!upcomingTrip || tripDateTime < new Date(upcomingTrip.dateTime).getTime()) {
                    upcomingTrip = trip;
                }
            }
          }
      }
    });
    return ongoingTrip || upcomingTrip; // Prioritize ongoing trip
  }
  return null;
};

export const getUpcomingAndOngoingTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  const tripsRef = ref(databaseInternal, CURRENT_TRIPS_PATH);
  const snapshot = await get(tripsRef); // Fetch all trips
  const trips: Trip[] = [];

  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      const trip = childSnapshot.val() as Trip;
      // Client-side filtering
      if (trip.driverId === driverId && (trip.status === 'upcoming' || trip.status === 'ongoing')) {
        trips.push(trip);
      }
    });
  }
  // Sort by dateTime in ascending order (earliest first)
  return trips.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
};


export const getCompletedTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  const tripsRef = ref(databaseInternal, `${FINISHED_TRIPS_PATH}/${driverId}`);
  const snapshot = await get(tripsRef); // Fetch all finished trips for the driver
  const trips: Trip[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      trips.push(childSnapshot.val() as Trip);
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

  await set(finishedTripRef, finishedTripData);
  await remove(originalTripRef);

  const userProfileRef = ref(databaseInternal, `users/${tripToEnd.driverId}`);
  await runTransaction(userProfileRef, (currentProfile: UserProfile | null) => {
    if (currentProfile) {
      currentProfile.tripsCount = (currentProfile.tripsCount || 0) + 1;
      currentProfile.updatedAt = serverTimestamp();
    }
    return currentProfile;
  });
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
