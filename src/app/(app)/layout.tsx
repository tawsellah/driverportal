
'use client';

import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { BottomNav } from '@/components/layout/bottom-nav';
import Link from 'next/link';
import { UserProvider, useUser } from '@/context/UserContext'; // Ensure this path is correct

function AppHeaderContent() {
  const { userProfile, isLoadingProfile } = useUser();

  return (
    <div className="container flex h-14 items-center justify-between">
      <Link href="/trips" className="text-2xl font-bold text-primary">
        توصيلة
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <AppHeaderContent />
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:container md:py-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </UserProvider>
  );
}
