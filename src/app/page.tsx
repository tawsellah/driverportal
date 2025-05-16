"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate auth check from localStorage
    const isLoggedIn = localStorage.getItem('tawsellah-isLoggedIn') === 'true';
    if (isLoggedIn) {
      router.replace('/trips');
    } else {
      router.replace('/auth/signin');
    }
    // Intentionally not setting setIsLoading to false here to let the redirect complete.
    // If direct rendering is needed, then setIsLoading(false) would be appropriate.
  }, [router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-lg">جار التحميل...</p> {/* Loading... */}
    </div>
  );
}