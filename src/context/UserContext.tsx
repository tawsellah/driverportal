
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { onAuthUserChangedListener, getUserProfile, type UserProfile } from '@/lib/firebaseService';
import { auth, database as mainDb } from '@/lib/firebase';
import { database as walletDatabase } from '@/lib/firebaseWallet';
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
  // Ref to hold profile and wallet listeners unsubscribe functions
  const listenersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Helper function to clear all active listeners
    const cleanupListeners = () => {
      listenersRef.current.forEach(unsubscribe => unsubscribe());
      listenersRef.current = [];
    };

    const authUnsubscribe = onAuthUserChangedListener(async (user) => {
      cleanupListeners();

      if (user && mainDb && walletDatabase) {
        setIsLoadingProfile(true);
        try {
          // 1. Fetch the initial, consolidated profile data using getUserProfile
          const initialProfile = await getUserProfile(user.uid);

          if (initialProfile) {
            // Access control checks
            if (initialProfile.status === 'pending') {
              signOut(auth);
              setAuthStatus(false);
              toast({ title: "الحساب قيد المراجعة", description: "حسابك لا يزال قيد المراجعة.", variant: "destructive" });
              router.push('/auth/signin');
              setIsLoadingProfile(false);
              return;
            }
             if (initialProfile.status === 'suspended') {
              signOut(auth);
              setAuthStatus(false);
              toast({ title: "تم تعليق الحساب", description: "تم تعليق حسابك. يرجى التواصل مع الدعم.", variant: "destructive" });
              router.push('/auth/signin');
              setIsLoadingProfile(false);
              return;
            }

            setUserProfile(initialProfile);

            // 2. Set up a dedicated listener for the wallet balance
            const walletRef = ref(walletDatabase, `wallets/${user.uid}/walletBalance`);
            const walletListener = onValue(walletRef, (snapshot) => {
              const newBalance = snapshot.exists() ? snapshot.val() : 0;
              setUserProfile(prevProfile => {
                // Ensure we don't update if profile is null, and only update if balance changed
                if (prevProfile && prevProfile.walletBalance !== newBalance) {
                  return { ...prevProfile, walletBalance: newBalance };
                }
                return prevProfile;
              });
            });
            
            // 3. Set up a listener for other user profile data that might change
            const userProfileRef = ref(mainDb, `users/${user.uid}`);
            const profileListener = onValue(userProfileRef, (snapshot) => {
                if (snapshot.exists()) {
                    const freshProfileData = snapshot.val();
                    setUserProfile(prevProfile => ({...(prevProfile || initialProfile), ...freshProfileData}));
                }
            });

            listenersRef.current.push(() => off(walletRef, 'value', walletListener));
            listenersRef.current.push(() => off(userProfileRef, 'value', profileListener));

          } else {
             // Profile doesn't exist, critical error
             signOut(auth);
             setAuthStatus(false);
             toast({ title: "خطأ في الحساب", description: "لم يتم العثور على ملفك الشخصي.", variant: "destructive" });
             router.push('/auth/signin');
          }
        } catch (error) {
            console.error("Error during user setup in UserContext:", error);
            signOut(auth);
            setAuthStatus(false);
            toast({ title: "خطأ في تحميل البيانات", description: "فشل تحميل بيانات الملف الشخصي.", variant: "destructive" });
            router.push('/auth/signin');
        } finally {
            setIsLoadingProfile(false);
        }

      } else {
        // User is signed out
        setUserProfile(null);
        setIsLoadingProfile(false);
      }
    });
    
    listenersRef.current.push(authUnsubscribe);

    // Cleanup on component unmount
    return () => cleanupListeners();
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
