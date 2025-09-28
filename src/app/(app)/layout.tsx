
'use client';

import type { ReactNode } from 'react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { UserProvider } from '@/context/UserContext'; 

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:container md:py-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </UserProvider>
  );
}
