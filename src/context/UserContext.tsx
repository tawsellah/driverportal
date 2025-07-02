
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { onAuthUserChangedListener, type UserProfile } from '@/lib/firebaseService';
import { auth, database } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { ref, onValue, off } from 'firebase/database';
import { setAuthStatus } from '@/lib/storage';

interface UserContextType {
  userProfile: UserProfile | null;
  isLoadingProfile: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // This listener handles auth state changes (login/logout)
    const authUnsubscribe = onAuthUserChangedListener((user) => {
      // Create a variable to hold the profile listener's unsubscribe function
      let profileUnsubscribe = () => {};

      if (user) {
        setIsLoadingProfile(true);
        const userProfileRef = ref(database, `users/${user.uid}`);
        
        // Set up the real-time listener on the user's profile data
        profileUnsubscribe = onValue(userProfileRef, (snapshot) => {
          if (snapshot.exists()) {
            const profile = snapshot.val() as UserProfile;

            // --- Access Control Logic for real-time changes ---
            if (profile.status === 'suspended') {
              signOut(auth); // Sign out from Firebase Auth
              setAuthStatus(false); // Update local storage flag
              setUserProfile(null); // Clear profile state
              setIsLoadingProfile(false); // Stop loading
              toast({
                title: "تم تعليق الحساب",
                description: "تم تعليق حسابك بسبب مخالفة السياسات. يرجى التواصل مع الدعم لمزيد من التفاصيل.",
                variant: "destructive",
                duration: 5000,
              });
              router.push('/auth/signin'); // Redirect to sign-in page
              return; // Stop further processing for this snapshot
            }
            
            setUserProfile(profile);
          } else {
            // Profile doesn't exist in the database, which is an inconsistent state. Sign out.
            signOut(auth);
            setAuthStatus(false);
            setUserProfile(null);
            router.push('/auth/signin');
          }
          setIsLoadingProfile(false);
        }, (error) => {
            // Handle potential database read errors
            console.error("Firebase onValue error:", error);
            signOut(auth);
            setAuthStatus(false);
            setUserProfile(null);
            setIsLoadingProfile(false);
            router.push('/auth/signin');
        });

      } else {
        // User is signed out or not present
        setUserProfile(null);
        setIsLoadingProfile(false);
      }
      
      // Return a cleanup function that detaches the profile listener when auth state changes
      return () => {
        off(userProfileRef, 'value');
      };
    });

    // Return the main auth listener's unsubscribe function to be called on component unmount
    return () => authUnsubscribe();
  }, [router, toast]);

  return (
    <UserContext.Provider value={{ userProfile, isLoadingProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
