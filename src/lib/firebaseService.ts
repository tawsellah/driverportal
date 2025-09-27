
"use client";

import { auth as authInternal , database as databaseInternal } from './firebase'; 
import { 
  onAuthStateChanged,
  type User as FirebaseAuthUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  createUserWithEmailAndPassword,
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
  rating?: number;
  tripsCount?: number;
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
  // Return an empty unsubscribe function if auth is not initialized
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
  if (!database) throw new Error("Firebase Database is not initialized.");
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

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!databaseInternal) return null;
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

export const doesPhoneOrEmailExist = async (phone: string, email: string): Promise<{ phoneExists: boolean, emailExists: boolean }> => {
    if (!database) throw new Error("Firebase Database is not initialized.");
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) {
        return { phoneExists: false, emailExists: false };
    }
    const users = snapshot.val();
    let phoneExists = false;
    let emailExists = false;
    for (const userId in users) {
        if (users[userId].phone === phone) {
            phoneExists = true;
        }
        if (users[userId].email === email) {
            emailExists = true;
        }
        if (phoneExists && emailExists) {
            break; 
        }
    }
    return { phoneExists, emailExists };
};

export const getUserByPhone = async (phone: string): Promise<UserProfile | null> => {
    if (!databaseInternal) return null;
    const usersRef = ref(databaseInternal, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
        const users = snapshot.val();
        for (const userId in users) {
            if (users[userId].phone === phone) {
                return users[userId] as UserProfile;
            }
        }
    }
    return null;
};


export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  if (!databaseInternal) return;
  const userRef = ref(databaseInternal, `users/${userId}`);
  await update(userRef, {...updates, updatedAt: serverTimestamp()});
};

export const createDriverAccount = async (
  profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  password: string
): Promise<string> => {
    if (!auth || !database) {
        throw new Error("Firebase Auth or Database is not initialized.");
    }
    
    // Step 1: Check if phone or email already exist in the database
    const { phoneExists, emailExists } = await doesPhoneOrEmailExist(profileData.phone, profileData.email);
    if (phoneExists) {
        throw new Error("PHONE_EXISTS");
    }
    if (emailExists) {
        throw new Error("EMAIL_EXISTS");
    }

    // Step 2: Create user in Firebase Auth using the real email
    let userId: string | null = null;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, profileData.email, password);
        userId = userCredential.user.uid;

        // Step 3: Prepare and save user profile data to Realtime Database
        const finalProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
            fullName: profileData.fullName,
            phone: profileData.phone,
            email: profileData.email,
            secondaryPhone: profileData.secondaryPhone || '',
            idNumber: profileData.idNumber,
            idPhotoUrl: profileData.idPhotoUrl,
            licenseNumber: profileData.licenseNumber,
            licenseExpiry: profileData.licenseExpiry,
            licensePhotoUrl: profileData.licensePhotoUrl,
            vehicleType: profileData.vehicleType,
            otherVehicleType: profileData.otherVehicleType || '',
            vehicleYear: profileData.vehicleYear,
            vehicleColor: profileData.vehicleColor,
            vehiclePlateNumber: profileData.vehiclePlateNumber,
            vehiclePhotosUrl: profileData.vehiclePhotosUrl,
            paymentMethods: { cash: true, click: false, clickCode: '' },
            rating: 5,
            tripsCount: 0,
            walletBalance: 0,
            status: 'pending' as const,
        };
        
        await saveUserProfile(userId, finalProfileData);
        
        // Step 4: Sign out the user after registration is complete
        await firebaseSignOut(auth);
        
        return userId;
    } catch (error: any) {
        // If user creation in auth succeeded but something else failed, delete the auth user to allow retry.
        if (userId) {
            const user = auth.currentUser;
            if (user && user.uid === userId) {
                await user.delete().catch(deleteError => {
                    console.error("Failed to delete orphaned auth user:", deleteError);
                });
            }
        }
        // Re-throw specific Firebase auth errors or the custom errors
        if (error.code === 'auth/email-already-in-use') {
             throw new Error("EMAIL_EXISTS");
        }
        throw error;
    }
};

export const addDriverToWaitingList = async (
  profileData: Omit<WaitingListDriverProfile, 'status' | 'createdAt'>
): Promise<void> => {
    if (!databaseInternal) return;
    const waitingListRef = ref(databaseInternal, 'drivers_waiting_list');
    const newDriverRef = push(waitingListRef);
    
    const dataToSave: WaitingListDriverProfile = {
        ...profileData,
        status: 'pending',
        createdAt: serverTimestamp()
    };
    
    await set(newDriverRef, dataToSave);
};


// --- Wallet Service (Charge Code Logic) ---

export const chargeWalletWithCode = async (
  userId: string,
  chargeCodeInputOriginal: string
): Promise<{ success: boolean; message: string; newBalance?: number }> => {
  // This function is disabled as per the instructions
  return { success: false, message: "This feature is temporarily disabled." };
};


// --- Trip Service ---
const CURRENT_TRIPS_PATH = 'currentTrips';
const FINISHED_TRIPS_PATH = 'finishedTrips';
const STOP_STATIONS_PATH = 'stopstations';
const SUPPORT_REQUESTS_PATH = 'supportRequests';


export const addTrip = async (driverId: string, tripData: NewTripData): Promise<Trip> => {
  if (!databaseInternal) throw new Error("Database not connected.");
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
