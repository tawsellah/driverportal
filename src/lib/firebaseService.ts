
"use client";

import { auth as authInternal , database as databaseInternal } from './firebase'; 
import { database as walletDatabaseInternal } from './firebaseWallet';
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
  otherVehicleType?: string;
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
}

export type NewTripData = Omit<Trip, 'id' | 'status' | 'earnings' | 'driverId' | 'createdAt' | 'updatedAt'>;

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
    if (!walletDatabaseInternal) return null;
    const walletRef = ref(walletDatabaseInternal, `wallets/${userId}`);
    const snapshot = await get(walletRef);
    if (snapshot.exists()) {
        return snapshot.val();
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
    const walletData = await getWalletData(userId);
    profile.walletBalance = walletData?.walletBalance || 0;

    if (!profile.topUpCodes) {
        profile.topUpCodes = {};
    }
    return profile;
  }
  return null;
};

export const doesPhoneOrEmailExist = async (phone: string, email: string): Promise<{ phoneExists: boolean, emailExists: boolean }> => {
    if (!databaseInternal) throw new Error("Firebase Database is not initialized.");
    
    // Check if phone number exists in 'users'
    const phoneQuery = query(ref(databaseInternal, 'users'), orderByChild('phone'), equalTo(phone));
    const phoneSnapshot = await get(phoneQuery);
    const phoneExists = phoneSnapshot.exists();

    // We can't directly check for email existence in the 'users' table without read access.
    // We will rely on Firebase Auth's error for email existence.
    return { phoneExists, emailExists: false };
};


export const getEmailByPhone = async (phone: string): Promise<string | null> => {
    if (!databaseInternal) return null;
    // Use the public phoneEmailMap instead of the protected 'users' path
    const mapRef = ref(databaseInternal, `phoneEmailMap/${phone}`);
    const snapshot = await get(mapRef).catch(e => {
        console.warn("Could not check phone number, might be a permissions issue. Relying on auth error.", e);
        return null;
    });
    if (snapshot && snapshot.exists()) {
        return snapshot.val().email;
    }
    return null;
};

// This function is for internal use during sign-in and password reset.
// It should not be used to get the full user profile.
export const getUserByPhone = async (phone: string): Promise<{email: string} | null> => {
    if (!databaseInternal) return null;
    const usersRef = ref(databaseInternal, 'users');
    const q = query(usersRef, orderByChild('phone'), equalTo(phone));
    const snapshot = await get(q);
    if (snapshot.exists()) {
        const users = snapshot.val();
        const userId = Object.keys(users)[0];
        const userProfile = users[userId];
        return { email: userProfile.email };
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
            status: 'pending' as const,
        };
        
        await saveUserProfile(userId, finalProfileData);
        
        // Save the phone-to-email mapping in the public map
        const mapRef = ref(database, `phoneEmailMap/${profileData.phone}`);
        await set(mapRef, { email: profileData.email });

        // Also create an entry in the wallet database
        if (walletDatabaseInternal) {
            const walletRef = ref(walletDatabaseInternal, `wallets/${userId}`);
            await set(walletRef, {
                walletBalance: 0,
                createdAt: serverTimestamp()
            });
        }
        
        await firebaseSignOut(auth);
        
        return userId;
    } catch (error: any) {
        // If user creation succeeded but subsequent database operations failed, delete the auth user
        if (userId) {
            const user = auth.currentUser;
            // Re-authenticate and delete if necessary, but for simplicity we'll try to delete directly.
            // This might fail if the token expired. A more robust solution involves re-authentication.
            if (user && user.uid === userId) {
                await user.delete().catch(deleteError => {
                    console.error("Failed to delete orphaned auth user:", deleteError);
                });
            }
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
  // This function is disabled
  console.warn("addDriverToWaitingList is disabled.");
};


// --- Wallet Service (Charge Code Logic) ---

export const chargeWalletWithCode = async (
  userId: string,
  chargeCodeInput: string
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  if (!walletDatabaseInternal) {
    return { success: false, message: "خدمة المحفظة غير متاحة حالياً." };
  }

  const chargeCode = chargeCodeInput.trim().toUpperCase();
  const codeRef = ref(walletDatabaseInternal, `chargeCodes/${chargeCode}`);

  return runTransaction(codeRef, (codeData) => {
    if (codeData === null) {
      // Code does not exist
      return; // Abort transaction
    }
    if (codeData.status === 'used') {
      // Code already used
      return; // Abort transaction
    }
    
    // Code is valid and unused, mark as used
    codeData.status = 'used';
    codeData.usedBy = userId;
    codeData.usedAt = serverTimestamp();
    
    return codeData;
  }).then(async (result) => {
    if (!result.committed) {
        // The transaction was aborted. Let's check why.
        const snapshot = await get(codeRef);
        if (!snapshot.exists()) {
            return { success: false, message: "كود الشحن غير صحيح." };
        }
        if (snapshot.val().status === 'used') {
            return { success: false, message: "كود الشحن هذا تم استخدامه مسبقاً." };
        }
        return { success: false, message: "فشل شحن الرصيد. الرجاء المحاولة مرة أخرى." };
    }

    // Transaction committed, now update the user's wallet
    const amountToAdd = result.snapshot.val().amount;
    const userWalletRef = ref(walletDatabaseInternal, `wallets/${userId}`);
    
    let newBalance = 0;
    await runTransaction(userWalletRef, (walletData) => {
        if (walletData) {
            walletData.walletBalance = (walletData.walletBalance || 0) + amountToAdd;
            newBalance = walletData.walletBalance;
        } else {
            // If wallet doesn't exist, create it
            walletData = { walletBalance: amountToAdd, createdAt: serverTimestamp() };
            newBalance = amountToAdd;
        }
        return walletData;
    });

    return { 
      success: true, 
      message: `تم شحن رصيدك بمبلغ ${amountToAdd.toFixed(2)} د.أ بنجاح!`,
      newBalance: newBalance
    };

  }).catch(error => {
      console.error("Transaction failed: ", error);
      return { success: false, message: "حدث خطأ غير متوقع أثناء شحن الرصيد." };
  });
};


// --- Trip Service ---
const CURRENT_TRIPS_PATH = 'currentTrips';
const FINISHED_TRIPS_PATH = 'finishedTrips';
const STOP_STATIONS_PATH = 'stopstations';
const SUPPORT_REQUESTS_PATH = 'supportRequests';


export const addTrip = async (driverId: string, tripData: NewTripData): Promise<Trip> => {
  // This function is disabled
  console.warn("addTrip is disabled.");
  // @ts-ignore
  return Promise.resolve({});
};

export const startTrip = async (tripId: string): Promise<void> => {
  // This function is disabled
  console.warn("startTrip is disabled.");
};

export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  // This function is disabled
  console.warn("updateTrip is disabled.");
};

export const deleteTrip = async (tripId: string): Promise<void> => {
  // This function is disabled
  console.warn("deleteTrip is disabled.");
};

export const getTripById = async (tripId: string): Promise<Trip | null> => {
  // This function is disabled
  console.warn("getTripById is disabled.");
  return null;
};

export const getUpcomingAndOngoingTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  // This function is disabled
  console.warn("getUpcomingAndOngoingTripsForDriver is disabled.");
  return [];
};


export const getActiveTripForDriver = async (driverId: string): Promise<Trip | null> => {
  // This function is disabled
  console.warn("getActiveTripForDriver is disabled.");
  return null;
};


export const getCompletedTripsForDriver = async (driverId: string): Promise<Trip[]> => {
  // This function is disabled
  console.warn("getCompletedTripsForDriver is disabled.");
  return [];
};


export const endTrip = async (tripToEnd: Trip, earnings: number): Promise<void> => {
  // This function is disabled
  console.warn("endTrip is disabled.");
};

export const getTrips = async (): Promise<Trip[]> => {
  // This function is disabled
  console.warn("getTrips is disabled.");
  return [];
};

// --- Booking Cancellation Service ---
export const cancelPassengerBooking = async (tripId: string, seatId: SeatID): Promise<{ success: boolean; message: string }> => {
  // This function is disabled
  console.warn("cancelPassengerBooking is disabled.");
  return { success: false, message: "This feature is temporarily disabled." };
};


// --- Stop Stations Service ---
export const generateRouteKey = (startPointId: string, destinationId: string): string => {
  return `${startPointId.toLowerCase()}_to_${destinationId.toLowerCase()}`;
};

export const getStopStationsForRoute = async (startPointId: string, destinationId: string): Promise<string[] | null> => {
  // This function is disabled
  console.warn("getStopStationsForRoute is disabled.");
  return null;
};

export const addStopsToRoute = async (startPointId: string, destinationId: string, newStops: string[]): Promise<void> => {
  // This function is disabled
  console.warn("addStopsToRoute is disabled.");
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

    