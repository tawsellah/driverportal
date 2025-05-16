
"use client"

import type { SeatID } from './constants';

// User Profile
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  idNumber?: string;
  idPhotoUrl?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  licensePhotoUrl?: string[];
  vehicleType?: string;
  vehicleMakeModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  vehiclePlateNumber?: string;
  vehiclePhotosUrl?: string[];
  rating?: number;
  tripsCount?: number;
  paymentMethods?: {
    click?: boolean;
    cash?: boolean;
    clickCode?: string;
  };
}

// Trip
export interface Trip {
  id: string;
  startPoint: string; // Governorate ID
  stops?: string[]; // Array of Governorate IDs
  destination: string; // Governorate ID
  dateTime: string; // ISO string
  expectedArrivalTime: string; // time string e.g., "10:00"
  offeredSeatIds: SeatID[]; // Specific seats offered by driver
  selectedSeats: SeatID[]; // Seats booked by passengers
  meetingPoint: string;
  pricePerPassenger: number;
  notes?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  earnings?: number; // For completed trips
  passengers?: any[]; // Simplified passenger data
}

const USER_PROFILE_KEY = 'tawsellah-userProfile';
const TRIPS_KEY = 'tawsellah-trips';
const AUTH_KEY = 'tawsellah-isLoggedIn';

// --- Auth ---
export const getAuthStatus = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_KEY) === 'true';
};

export const setAuthStatus = (isLoggedIn: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_KEY, String(isLoggedIn));
};

// --- User Profile ---
export const getUserProfile = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(USER_PROFILE_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveUserProfile = (profile: UserProfile): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
};

// --- Trips ---
export const getTrips = (): Trip[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(TRIPS_KEY);
  return data ? (JSON.parse(data) as Trip[]).map(trip => ({
    ...trip,
    offeredSeatIds: trip.offeredSeatIds || [], // Ensure offeredSeatIds exists
    selectedSeats: trip.selectedSeats || [], // Ensure selectedSeats exists
  })) : [];
};

export const saveTrips = (trips: Trip[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
};

export interface NewTripData extends Omit<Trip, 'id' | 'status' | 'selectedSeats' | 'passengers' | 'earnings'> {
  // availableSeats is derived from offeredSeatIds.length
}

export const addTrip = (tripData: NewTripData): Trip => {
  const newTrip: Trip = {
    ...tripData,
    id: Date.now().toString(), // Simple ID generation
    status: 'upcoming',
    selectedSeats: [],
    passengers: [],
  };
  const trips = getTrips();
  trips.push(newTrip);
  saveTrips(trips);
  return newTrip;
};

export const updateTrip = (updatedTrip: Trip): void => {
  let trips = getTrips();
  trips = trips.map(trip => (trip.id === updatedTrip.id ? updatedTrip : trip));
  saveTrips(trips);
};

export const deleteTrip = (tripId: string): void => {
  let trips = getTrips();
  trips = trips.filter(trip => trip.id !== tripId);
  saveTrips(trips);
};

// --- Mock Initial Data (for development) ---
export const initializeMockData = () => {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(USER_PROFILE_KEY)) {
    saveUserProfile({
      id: 'driver001',
      fullName: 'أحمد محمد',
      email: 'driver@tawsellah.com', // Matched with signin
      phone: '0791234567',
      rating: 4.5,
      tripsCount: 20,
      paymentMethods: { cash: true, click: false },
      idNumber: '1234567890',
      licenseNumber: 'L98765',
      vehicleMakeModel: 'تويوتا كامري',
      vehiclePlateNumber: '10-12345',
      vehicleType: 'sedan',
      vehicleYear: '2020',
      vehicleColor: 'أبيض'
    });
  }

  if (!localStorage.getItem(TRIPS_KEY)) {
    const mockTrips: Trip[] = [
      {
        id: '1',
        startPoint: 'amman',
        destination: 'irbid',
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        expectedArrivalTime: '10:00',
        offeredSeatIds: ['front_passenger', 'back_right', 'back_left'],
        selectedSeats: ['front_passenger'] as SeatID[],
        meetingPoint: 'دوار الداخلية',
        pricePerPassenger: 5,
        status: 'upcoming',
        passengers: [{}],
      },
      {
        id: '2',
        startPoint: 'zarqa',
        destination: 'aqaba',
        stops: ['madaba'],
        dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        expectedArrivalTime: '17:00',
        offeredSeatIds: ['front_passenger', 'back_right'],
        selectedSeats: [] as SeatID[],
        meetingPoint: 'مجمع الباصات',
        pricePerPassenger: 15,
        status: 'upcoming',
        passengers: [],
      },
      {
        id: '3',
        startPoint: 'amman',
        destination: 'jerash',
        dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        expectedArrivalTime: '14:00',
        offeredSeatIds: ['front_passenger', 'back_right', 'back_middle', 'back_left'],
        selectedSeats: ['front_passenger', 'back_right', 'back_middle', 'back_left'] as SeatID[],
        meetingPoint: 'الجامعة الأردنية',
        pricePerPassenger: 3,
        status: 'completed',
        earnings: 12,
        passengers: [{}, {}, {}, {}],
      },
    ];
    saveTrips(mockTrips);
  }
};
