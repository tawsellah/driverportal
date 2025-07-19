
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  // Ref to hold the profile listener unsubscribe function
  const profileUnsubscribeRef = useRef<() => void>(() => {});

  useEffect(() => {
    // This listener handles auth state changes (login/logout)
    const authUnsubscribe = onAuthUserChangedListener((user) => {
      // Detach any existing profile listener before setting up a new one
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
      }

      if (user) {
        setIsLoadingProfile(true);
        const userProfileRef = ref(database, `users/${user.uid}`);
        
        // Set up the real-time listener on the user's profile data
        const profileListener = onValue(userProfileRef, (snapshot) => {
          if (snapshot.exists()) {
            const profile = snapshot.val() as UserProfile;

            // --- Access Control Logic for real-time changes ---
            if (profile.status === 'suspended') {
              signOut(auth); 
              setAuthStatus(false);
              setUserProfile(null); 
              setIsLoadingProfile(false); 
              toast({
                title: "تم تعليق الحساب",
                description: "تم تعليق حسابك بسبب مخالفة السياسات. يرجى التواصل مع الدعم لمزيد من التفاصيل.",
                variant: "destructive",
                duration: 5000,
              });
              router.push('/auth/signin'); 
              return; 
            }
            
            setUserProfile(profile);
          } else {
             // Profile doesn't exist, which might be a temporary state during signup.
             // We don't sign out here anymore to prevent logging out on refresh.
             // The sign-in page logic will handle access control.
             setUserProfile(null);
          }
          setIsLoadingProfile(false);
        }, (error) => {
            console.error("Firebase onValue error:", error);
            signOut(auth);
            setAuthStatus(false);
            setUserProfile(null);
            setIsLoadingProfile(false);
            router.push('/auth/signin');
        });

        // Store the new unsubscribe function in the ref
        profileUnsubscribeRef.current = () => off(userProfileRef, 'value', profileListener);

      } else {
        // User is signed out or not present
        setUserProfile(null);
        setIsLoadingProfile(false);
        // Ensure any lingering listener is detached
        if (profileUnsubscribeRef.current) {
            profileUnsubscribeRef.current();
        }
      }
    });

    // Cleanup on component unmount
    return () => {
        authUnsubscribe();
        if (profileUnsubscribeRef.current) {
            profileUnsubscribeRef.current();
        }
    };
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
