"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ListChecks, UserCircle, Route } from "lucide-react" // Replaced History with ListChecks, Profile with UserCircle, Trips with Home/Route
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/trips", label: "الرحلات", icon: Route },
  { href: "/history", label: "السجل", icon: ListChecks },
  { href: "/profile", label: "الملف الشخصي", icon: UserCircle },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-t-md">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 rounded-md p-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-6 w-6", isActive && "fill-primary stroke-primary-foreground")} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}