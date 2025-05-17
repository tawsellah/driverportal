
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { onAuthUserChangedListener } from '@/lib/firebaseService'; // Using Firebase auth state

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthUserChangedListener((user) => {
      if (user) {
        // User is signed in, redirect to trips page.
        router.replace('/trips');
      } else {
        // User is signed out, redirect to signin page.
        router.replace('/auth/signin');
      }
      // setIsLoading(false); // Keep loading until redirect is complete
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-lg">جار التحميل...</p> {/* Loading... */}
    </div>
  );
}

