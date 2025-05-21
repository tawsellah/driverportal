
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthUserChangedListener, getUserProfile, type UserProfile } from '@/lib/firebaseService';

interface UserContextType {
  userProfile: UserProfile | null;
  isLoadingProfile: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthUserChangedListener(async (user) => {
      setIsLoadingProfile(true); // Set loading true at the start of auth change
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          setUserProfile(null); // Set to null on error
        }
      } else {
        setUserProfile(null);
      }
      setIsLoadingProfile(false);
    });
    return () => unsubscribe();
  }, []);

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
