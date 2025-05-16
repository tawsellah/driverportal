
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { BottomNav } from '@/components/layout/bottom-nav';
import Link from 'next/link';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/trips" className="text-2xl font-bold text-primary">
            توصيلة
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-20 md:container md:py-6"> {/* pb-20 for bottom nav */}
        {children}
      </main>
      <BottomNav />
    </div>
  );