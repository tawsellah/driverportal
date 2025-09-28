

"use client";

import { auth as authInternal , database as databaseInternal } from './firebase'; 
import { database as walletDatabaseInternal } from './firebaseWallet';
import { database as tripsDatabaseInternal } from './firebaseTrips';
import { 
  onAuthStateChanged,
  type User as FirebaseAuthUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { ref, set, get, child, update, remove, query, orderByChild, equalTo, serverTimestamp, runTransaction, push } from 'firebase/database';
import type { SeatID } from './constants';
import { SEAT_CONFIG } from './constants'; 
import { useToast } from '@/hooks/use-toast';

export const auth = authInternal;
export const database = databaseInternal;

export interface PassengerBookingDetails {
  userId: string;
  phone: string;
  fullName: string; 
  bookedAt: any; 
  paymentType?: string; // e.g., "cash", "click"
  dropOffPoint?: string; // e.g., "Stop Name 1"
  fees?: number; // Added fees
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
  secondaryPhone?: string;
  idNumber?: string;
  idPhotoUrl?: string | null; 
  licenseNumber?: string;
  licenseExpiry?: string;
  licensePhotoUrl?: string | null; 
  vehicleType?: string;
  otherVehicleType?: string | null;
  vehicleYear?: string;
  vehicleColor?: string;
  vehiclePlateNumber?: string;
  vehiclePhotosUrl?: string | null;
  paymentMethods?: {
    click?: boolean;
    cash?: boolean;
    clickCode?: string;
  };
  walletBalance?: number; 
  topUpCodes?: Record<string, UserProfileTopUpCode>;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: any; 
  updatedAt?: any;
  rating: number;
  tripsCount: number;
}

export interface WalletTransaction {
    id: string;
    type: 'charge' | 'trip_earning' | 'trip_fee' | 'system_adjustment';
    amount: number; // Positive for income, negative for outcome
    date: any; // serverTimestamp
    description: string;
    tripId?: string;
}


export interface WaitingListDriverProfile {
  fullName: string;
  phone: string;
  secondaryPhone?: string;
  password?: string;
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
  status: 'pending' | 'approved' | 'rejected';
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
  selectedSeats: SeatID[];
}

export type NewTripData = Omit<Trip, 'id' | 'status' | 'earnings' | 'driverId' | 'createdAt' | 'updatedAt' | 'selectedSeats'>;

export interface SupportRequestData {
  userId: string;
  fullName: string;
  phone: string;
  message: string;
  status?: 'new' | 'in_progress' | 'resolved';
  createdAt?: any;
}


// --- Auth Service ---
export const getCurrentUser = (): FirebaseAuthUser | null => {
  if (!authInternal) return null;
  return authInternal.currentUser;
};

export const onAuthUserChangedListener = (callback: (user: FirebaseAuthUser | null) => void) => {
  if (!authInternal) return () => {};
  return onAuthStateChanged(authInternal, callback);
};

export const reauthenticateAndChangePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("المستخدم غير مسجل الدخول أو لا يوجد بريد إلكتروني مرتبط.");
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);

  // Re-authenticate the user
  await reauthenticateWithCredential(user, credential);
  
  // If re-authentication is successful, update the password
  await updatePassword(user, newPassword);
};


// --- User Profile Service ---
export const saveUserProfile = async (userId: string, profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' >): Promise<void> => {
  if (!databaseInternal) throw new Error("Firebase Database is not initialized.");
  const userRef = ref(databaseInternal, `users/${userId}`);
  const fullProfileData: UserProfile = {
    id: userId,
    ...profileData,
    status: profileData.status || 'pending',
    walletBalance: profileData.walletBalance || 0,
    topUpCodes: profileData.topUpCodes || {},
    createdAt: serverTimestamp(),
  };
  await set(userRef, fullProfileData);
};

export const getWalletData = async (userId: string): Promise<{walletBalance: number} | null> => {
    if (!walletDatabaseInternal) return { walletBalance: 0 };
    const walletRef = ref(walletDatabaseInternal, `wallets/${userId}`);
    try {
        const snapshot = await get(walletRef);
        if (snapshot.exists()) {
            return snapshot.val();
        }
    } catch (e) {
        console.warn("Could not get wallet data, returning default. This is expected if the node doesn't exist yet.", e);
    }
    return { walletBalance: 0 };
};


export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!databaseInternal) return null;
  const userRef = ref(databaseInternal, `users/${userId}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    const profile = snapshot.val() as UserProfile;
    
    // Fetch wallet data from the separate wallet database
    try {
        const walletData = await getWalletData(userId);
        profile.walletBalance = walletData?.walletBalance || 0;
    } catch (walletError) {
        console.warn("Could not fetch wallet data for profile, defaulting to 0. This is expected if the wallet doesn't exist yet.", walletError);
        profile.walletBalance = 0;
    }


    if (!profile.topUpCodes) {
        profile.topUpCodes = {};
    }
    return profile;
  }
  return null;
};

export const doesPhoneOrEmailExist = async (phone: string, email: string): Promise<{ phoneExists: boolean, emailExists: boolean }> => {
    if (!databaseInternal) throw new Error("Firebase Database is not initialized.");
    
    // Check if phone number exists in the public map. This requires the '/phoneEmailMap' path to have public read access.
    const phoneMapRef = ref(databaseInternal, `phoneEmailMap/${phone}`);
    const phoneSnapshot = await get(phoneMapRef);
    const phoneExists = phoneSnapshot.exists();

    // We can't directly check for email existence in the 'users' table without read access.
    // We will rely on Firebase Auth's error for email existence, so we can return false here.
    return { phoneExists, emailExists: false };
};


export const getEmailByPhone = async (phone: string): Promise<string | null> => {
    if (!databaseInternal) return null;
    // Use the public phoneEmailMap instead of the protected 'users' path
    // IMPORTANT: This requires '.read': true on the 'phoneEmailMap' path in your Firebase rules.
    const mapRef = ref(databaseInternal, `phoneEmailMap/${phone}`);
    const snapshot = await get(mapRef);
    if (snapshot.exists()) {
        return snapshot.val().email;
    }
    return null;
};

// This function is for internal use during sign-in and password reset.
// It should not be used to get the full user profile.
export const getUserByPhone = async (phone: string): Promise<{email: string} | null> => {
    // This function is now a wrapper around getEmailByPhone
    const email = await getEmailByPhone(phone);
    if (email) {
        return { email };
    }
    return null;
};


export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  if (!databaseInternal) return;
  const userRef = ref(databaseInternal, `users/${userId}`);
  // Separate wallet updates from profile updates
  const { walletBalance, ...profileUpdates } = updates;

  if (Object.keys(profileUpdates).length > 0) {
     await update(userRef, {...profileUpdates, updatedAt: serverTimestamp()});
  }

  if (walletBalance !== undefined && walletDatabaseInternal) {
      const walletRef = ref(walletDatabaseInternal, `wallets/${userId}`);
      await update(walletRef, { walletBalance });
  }
};

export const createDriverAccount = async (
  profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  password: string
): Promise<string> => {
    if (!auth || !database) {
        throw new Error("Firebase Auth or Database is not initialized.");
    }

    let userId: string | null = null;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, profileData.email, password);
        userId = userCredential.user.uid;

        const finalProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
            ...profileData,
            otherVehicleType: profileData.otherVehicleType || null, // Ensure null instead of undefined
            status: 'pending' as const,
        };
        
        await saveUserProfile(userId, finalProfileData);
        
        // Write to phoneEmailMap for login lookup
        const phoneMapRef = ref(database, `phoneEmailMap/${profileData.phone}`);
        await set(phoneMapRef, { email: profileData.email });
        
        // Also create an entry in the wallet database
        if (walletDatabaseInternal) {
            const walletRef = ref(walletDatabaseInternal, `wallets/${userId}`);
            await set(walletRef, {
                walletBalance: 0,
                createdAt: serverTimestamp()
            });
        }
        
        // Sign out the user after registration so they have to log in.
        await firebaseSignOut(auth);
        
        return userId;
    } catch (error: any) {
        if (userId) {
            console.error(`Orphaned user created in Auth with UID: ${userId}. DB operations failed.`, error);
        }
        if (error.code === 'auth/email-already-in-use') {
             throw new Error("EMAIL_EXISTS");
        }
        throw error;
    }
};

export const addDriverToWaitingList = async (
  profileData: Omit<WaitingListDriverProfile, 'status' | 'createdAt'>
): Promise<void> => {
    if (!database) return;

    const newDriverRef = push(ref(database, 'users'));
    const userId = newDriverRef.key;

    if (!userId) throw new Error("Could not generate a new user ID.");

    // This is essentially creating a user profile directly
    const fullProfile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        fullName: profileData.fullName,
        phone: profileData.phone,
        email: 'placeholder@email.com', // Placeholder email, main registration should handle this
        secondaryPhone: profileData.secondaryPhone || '',
        idNumber: profileData.idNumber,
        idPhotoUrl: profileData.idPhotoUrl,
        licenseNumber: profileData.licenseNumber,
        licenseExpiry: profileData.licenseExpiry,
        licensePhotoUrl: profileData.licensePhotoUrl,
        vehicleType: profileData.vehicleType,
        otherVehicleType: null,
        vehicleYear: profileData.vehicleYear,
        vehicleColor: profileData.vehicleColor,
        vehiclePlateNumber: profileData.vehiclePlateNumber,
        vehiclePhotosUrl: profileData.vehiclePhotosUrl,
        paymentMethods: { cash: true, click: false, clickCode: '' },
        rating: 5,
        tripsCount: 0,
        walletBalance: 0,
        status: 'pending',
    };

    await saveUserProfile(userId, fullProfile);
};


// --- Wallet Service (Charge Code Logic) ---

const addWalletTransaction = async (userId: string, transaction: Omit<WalletTransaction, 'id'>): Promise<void> => {
    if (!walletDatabaseInternal) return;
    const transactionsRef = ref(walletDatabaseInternal, `walletTransactions/${userId}`);
    const newTransactionRef = push(transactionsRef);
    await set(newTransactionRef, {
        id: newTransactionRef.key,
        ...transaction,
    });
};

export const chargeWalletWithCode = async (
  userId: string,
  chargeCodeInput: string
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  if (!walletDatabaseInternal) {
    return { success: false, message: "خدمة المحفظة غير متاحة حالياً." };
  }

  const chargeCode = chargeCodeInput.trim().toUpperCase();
  const codeRef = ref(walletDatabaseInternal, `chargeCodes/${chargeCode}`);
  const userWalletRef = ref(walletDatabaseInternal, `wallets/${userId}`);

  try {
    // 1. Read the code to check its validity.
    const codeSnapshot = await get(codeRef);
    if (!codeSnapshot.exists()) {
      return { success: false, message: "كود الشحن غير صحيح." };
    }

    const codeData = codeSnapshot.val();
    if (codeData.status !== 'unused') {
      return { success: false, message: "كود الشحن تم استخدامه مسبقاً." };
    }
    
    const amountToAdd = codeData.amount;
    if (!amountToAdd || typeof amountToAdd !== 'number' || amountToAdd <= 0) {
        return { success: false, message: "كود الشحن يحتوي على قيمة غير صالحة." };
    }

    // 2. If the code is valid, run a transaction on the user's wallet.
    const transactionResult = await runTransaction(userWalletRef, (walletData) => {
        if (walletData) {
            walletData.walletBalance = (walletData.walletBalance || 0) + amountToAdd;
        } else {
            walletData = { walletBalance: amountToAdd, createdAt: serverTimestamp() };
        }
        walletData.updatedAt = serverTimestamp();
        return walletData;
    });

    if (transactionResult.committed && transactionResult.snapshot.exists()) {
        const newBalance = transactionResult.snapshot.val().walletBalance;

        // 3. Log the successful transaction.
        await addWalletTransaction(userId, {
            type: 'charge',
            amount: amountToAdd,
            date: serverTimestamp(),
            description: `تم شحن الرصيد بنجاح باستخدام الكود: ${chargeCode}`
        });
        
        // IMPORTANT: The backend/admin is responsible for marking the code as 'used'
        // after seeing the walletTransaction log. We do not do it from the client
        // to respect the security rules.

        return { 
          success: true, 
          message: `تم شحن رصيدك بمبلغ ${amountToAdd.toFixed(2)} د.أ بنجاح!`,
          newBalance
        };
    } else {
        throw new Error("فشلت عملية تحديث رصيد المحفظة.");
    }

  } catch (error: any) {
      console.error("Charge wallet failed: ", error);
      if (error.code === 'PERMISSION_DENIED') {
        return { success: false, message: "خطأ في الصلاحيات. لا يمكن التحقق من كود الشحن." };
      }
      return { success: false, message: "حدث خطأ غير متوقع أثناء شحن الرصيد." };
  }
};


export const getWalletTransactions = async (userId: string): Promise<WalletTransaction[]> => {
    if (!walletDatabaseInternal) return [];
    try {
        const transactionsRef = query(ref(walletDatabaseInternal, `walletTransactions/${userId}`), orderByChild('date'));
        const snapshot = await get(transactionsRef);
        if (snapshot.exists()) {
            const transactions: WalletTransaction[] = [];
            snapshot.forEach((childSnapshot) => {
                transactions.push({ id: childSnapshot.key!, ...childSnapshot.val() });
            });
            return transactions.reverse(); // Show most recent first
        }
        return [];
    } catch (error: any) {
        // Gracefully handle cases where the transactions path doesn't exist yet.
        if (error.message && (error.message.includes("does not exist") || error.message.includes("Permission denied"))) {
            console.warn("Wallet transactions path does not exist for user or is inaccessible, returning empty array.", error.message);
            return [];
        }
        console.error("Error fetching wallet transactions:", error);
        throw error;
    }
};


// --- Trip Service ---
const CURRENT_TRIPS_PATH = 'currentTrips';
const FINISHED_TRIPS_PATH = 'finishedTrips';
const STOP_STATIONS_PATH = 'stopstations';
const SUPPORT_REQUESTS_PATH = 'supportRequests';


export const addTrip = async (driverId: string, tripData: NewTripData): Promise<Trip> => {
  if (!tripsDatabaseInternal) throw new Error("Trips database is not initialized.");
  const newTripRef = push(ref(tripsDatabaseInternal, CURRENT_TRIPS_PATH));
  const newTripId = newTripRef.key;
  if (!newTripId) throw new Error("Could not create new trip ID.");

  const fullTripData: Trip = {
    id: newTripId,
    driverId: driverId,
    ...tripData,
    status: 'upcoming',
    createdAt: serverTimestamp(),
    selectedSeats: [],
  };

  await set(newTripRef, fullTripData);
  return fullTripData;
};

export const startTrip = async (tripId: string): Promise<void> => {
  if (!tripsDatabaseInternal) return;
  const tripRef = ref(tripsDatabaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const snapshot = await get(tripRef);
  if (snapshot.exists()) {
    const trip = snapshot.val() as Trip;
    if (trip.status === 'upcoming') {
      await update(tripRef, { status: 'ongoing', updatedAt: serverTimestamp() });
    } else {
      throw new Error("لا يمكن بدء رحلة ليست قادمة.");
    }
  } else {
    throw new Error("Trip not found.");
  }
};

export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  if (!tripsDatabaseInternal) return;
  const tripRef = ref(tripsDatabaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  await update(tripRef, { ...updates, updatedAt: serverTimestamp() });
};

export const deleteTrip = async (tripId: string): Promise<void> => {
  if (!tripsDatabaseInternal) return;
  const tripRef = ref(tripsDatabaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const snapshot = await get(tripRef);
  if (snapshot.exists()) {
      const trip = snapshot.val() as Trip;
      if (trip.status === 'upcoming' || trip.status === 'cancelled') {
           const finishedTripRef = ref(tripsDatabaseInternal, `${FINISHED_TRIPS_PATH}/${tripId}`);
           await set(finishedTripRef, { ...trip, status: 'cancelled', updatedAt: serverTimestamp() });
           await remove(tripRef);
      } else {
          throw new Error("لا يمكن إلغاء رحلة جارية أو مكتملة. يجب إنهاؤها.");
      }
  }
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  if (!tripsDatabaseInternal) return null;
  const tripRef = ref(tripsDatabaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}`);
  const snapshot = await get(tripRef);
  if (snapshot.exists()) {
    return snapshot.val() as Trip;
  }
  // If not in current, check finished trips
  const finishedTripRef = ref(tripsDatabaseInternal, `${FINISHED_TRIPS_PATH}/${tripId}`);
  const finishedSnapshot = await get(finishedTripRef);
  if(finishedSnapshot.exists()){
      return finishedSnapshot.val() as Trip;
  }
  return null;
};

export const getUpcomingAndOngoingTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  if (!tripsDatabaseInternal) return [];
  try {
    const tripsRef = query(ref(tripsDatabaseInternal, CURRENT_TRIPS_PATH), orderByChild('driverId'), equalTo(driverId));
    const snapshot = await get(tripsRef);
    if (snapshot.exists()) {
      const trips: Trip[] = [];
      snapshot.forEach((childSnapshot) => {
        const trip = childSnapshot.val();
        if (trip.status === 'upcoming' || trip.status === 'ongoing') {
          trips.push(trip);
        }
      });
      // Sort by date: ongoing first, then upcoming sorted by date
      return trips.sort((a, b) => {
          if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
          if (a.status !== 'ongoing' && b.status === 'ongoing') return 1;
          return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      });
    }
  } catch (e) {
      console.warn("Could not get upcoming/ongoing trips, registry might be empty.", e);
  }
  return [];
};


export const getActiveTripForDriver = async (driverId: string): Promise<Trip | null> => {
  if (!tripsDatabaseInternal) return null;
  try {
    const tripsRef = query(ref(tripsDatabaseInternal, CURRENT_TRIPS_PATH), orderByChild('driverId'), equalTo(driverId));
    const snapshot = await get(tripsRef);
    if (snapshot.exists()) {
      let activeTrip: Trip | null = null;
      snapshot.forEach((childSnapshot) => {
        const trip = childSnapshot.val() as Trip;
        if (trip.status === 'upcoming' || trip.status === 'ongoing') {
          activeTrip = trip;
          // Exit loop early if found
          return true;
        }
      });
      return activeTrip;
    }
  } catch(e){
    console.warn("Could not check for active trip, assuming none. This is expected if 'currentTrips' doesn't exist.", e);
  }
  return null;
};


export const getCompletedTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  if (!tripsDatabaseInternal) return [];
  const tripsRef = query(ref(tripsDatabaseInternal, FINISHED_TRIPS_PATH), orderByChild('driverId'), equalTo(driverId));
  const snapshot = await get(tripsRef);
  const trips: Trip[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      trips.push(childSnapshot.val());
    });
  }
  // sort by date descending
  return trips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};


export const endTrip = async (tripToEnd: Trip, earnings: number): Promise<void> => {
  if (!tripsDatabaseInternal) return;
  const currentTripRef = ref(tripsDatabaseInternal, `${CURRENT_TRIPS_PATH}/${tripToEnd.id}`);
  const finishedTripRef = ref(tripsDatabaseInternal, `${FINISHED_TRIPS_PATH}/${tripToEnd.id}`);

  const finishedTripData = {
    ...tripToEnd,
    status: 'completed' as const,
    earnings: earnings,
    updatedAt: serverTimestamp()
  };

  // Record the finished trip
  await set(finishedTripRef, finishedTripData);
  
  // Remove from current trips
  await remove(currentTripRef);

  // First, record the wallet transaction for trip earnings.
  if (earnings > 0 && walletDatabaseInternal) {
    await addWalletTransaction(tripToEnd.driverId, {
      type: 'trip_earning',
      amount: earnings,
      date: serverTimestamp(),
      description: `أرباح من رحلة رقم ${tripToEnd.id}`,
      tripId: tripToEnd.id,
    });
  }
};


export const getTrips = async (): Promise<Trip[]> => {
    if (!tripsDatabaseInternal) return [];
    const currentTripsRef = ref(tripsDatabaseInternal, CURRENT_TRIPS_PATH);
    const snapshot = await get(currentTripsRef);
    if (snapshot.exists()) {
        const trips: Trip[] = [];
        snapshot.forEach(childSnapshot => {
            trips.push(childSnapshot.val());
        });
        return trips;
    }
    return [];
};

// --- Booking Cancellation Service ---
export const cancelPassengerBooking = async (tripId: string, seatId: SeatID): Promise<{ success: boolean; message: string }> => {
  if (!tripsDatabaseInternal) return { success: false, message: "Trips database is not initialized."};
  const seatRef = ref(tripsDatabaseInternal, `${CURRENT_TRIPS_PATH}/${tripId}/offeredSeatsConfig/${seatId}`);

  return runTransaction(seatRef, (currentData) => {
    if (currentData === null || typeof currentData !== 'object') {
      // Seat is not booked, or data is malformed
      return; // Abort
    }
    // If it's an object, it's booked. We revert it to `true` (available).
    return true;
  }).then(result => {
    if (result.committed) {
      return { success: true, message: "تم إلغاء حجز الراكب بنجاح." };
    } else {
      return { success: false, message: "فشل إلغاء الحجز. قد يكون المقعد غير محجوز أصلاً." };
    }
  }).catch(error => {
    console.error("Passenger cancellation transaction failed: ", error);
    return { success: false, message: "حدث خطأ غير متوقع أثناء الإلغاء." };
  });
};


// --- Stop Stations Service ---
export const generateRouteKey = (startPointId: string, destinationId: string): string => {
  return `${startPointId.toLowerCase()}_to_${destinationId.toLowerCase()}`;
};

export const getStopStationsForRoute = async (startPointId: string, destinationId: string): Promise<string[] | null> => {
  if (!tripsDatabaseInternal) return null;
  const routeKey = generateRouteKey(startPointId, destinationId);
  const routeRef = ref(tripsDatabaseInternal, `${STOP_STATIONS_PATH}/${routeKey}`);
  const snapshot = await get(routeRef);
  if (snapshot.exists()) {
    const stopsObject = snapshot.val();
    // Firebase returns an object with keys, convert to an array of names
    return Object.values(stopsObject) as string[];
  }
  return null;
};

export const addStopsToRoute = async (startPointId: string, destinationId: string, newStops: string[]): Promise<void> => {
  if (!tripsDatabaseInternal || newStops.length === 0) return;
  const routeKey = generateRouteKey(startPointId, destinationId);
  const routeRef = ref(tripsDatabaseInternal, `${STOP_STATIONS_PATH}/${routeKey}`);

  const existingStopsSnapshot = await get(routeRef);
  const existingStops: string[] = existingStopsSnapshot.exists() ? Object.values(existingStopsSnapshot.val()) : [];
  
  const stopsToAdd: Record<string, string> = {};
  newStops.forEach(stop => {
    if (stop && !existingStops.includes(stop)) {
      // Use push to generate a unique key for each stop to avoid overwrites
      const newStopRef = push(routeRef);
      // @ts-ignore
      stopsToAdd[newStopRef.key] = stop;
    }
  });

  if (Object.keys(stopsToAdd).length > 0) {
    await update(routeRef, stopsToAdd);
  }
};

// --- Support Service ---
export const submitSupportRequest = async (data: Omit<SupportRequestData, 'status' | 'createdAt'>): Promise<void> => {
    if (!databaseInternal) return;
    const supportRequestsRef = ref(databaseInternal, SUPPORT_REQUESTS_PATH);
    const newRequestRef = push(supportRequestsRef);
    const requestData: SupportRequestData = {
        ...data,
        status: 'new',
        createdAt: serverTimestamp(),
    };
    await set(newRequestRef, requestData);
};

    




