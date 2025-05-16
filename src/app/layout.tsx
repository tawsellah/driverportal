import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'توصيلة السائقين - Tawsellah Drivers',
  description: 'منصة توصيلة لربط السائقين بالركاب في الأردن',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

// Replaced ThemeProvider with a simpler one for this context as ShadCN's ThemeProvider is not directly available in this scaffold.
// The ThemeProvider from 'next-themes' is commonly used with ShadCN, but since it's not in package.json,
// I've provided a basic one in components/theme-provider.tsx.
// For production, consider 'next-themes'.
// Also updated the HTML tag structure for lang, dir, and suppressHydrationWarning.