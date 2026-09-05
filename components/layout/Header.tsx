"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, User, Heart, ShoppingBag, Menu, X, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "Dogs", href: "/dogs" },
  { label: "Cats", href: "/cats" },
  { label: "Food", href: "/category/dog-food" },
  { label: "Treats", href: "/category/treats" },
  { label: "Supplies", href: "/category/accessories" },
  { label: "Brands", href: "/brands" },
  { label: "Deals", href: "/deals" },
]

export function Header({ cartCount = 0 }: { cartCount?: number }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-cream/95 backdrop-blur">
      <div className="container flex h-16 items-center gap-4">
        <button
          type="button"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink lg:hidden"
          aria-label="Open menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link href="/" className="font-display text-2xl font-bold tracking-tight text-forest">
          PETORA
        </Link>

        <nav className="ml-6 hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-600 transition-colors hover:text-forest"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <form action="/search" className="ml-auto hidden flex-1 max-w-md items-center md:flex">
          <div className="relative w-full">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              name="q"
              placeholder="Search food, treats, toys..."
              className="h-10 w-full rounded-full border border-ink-200 bg-white pl-9 pr-4 text-sm placeholder:text-ink-400 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>
        </form>

        <div className={cn("flex items-center gap-1", "md:ml-auto lg:ml-0")}>
          <Link href="/search" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50 md:hidden" aria-label="Search">
            <Search size={20} />
          </Link>
          <Link href="/help" className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50 sm:flex" aria-label="Help">
            <HelpCircle size={20} />
          </Link>
          <Link href="/account" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50" aria-label="Account">
            <User size={20} />
          </Link>
          <Link href="/account/wishlist" className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50 sm:flex" aria-label="Wishlist">
            <Heart size={20} />
          </Link>
          <Link href="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50" aria-label="Cart">
            <ShoppingBag size={20} />
            {cartCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-ink-100 bg-cream px-4 pb-4 pt-2 lg:hidden">
          <ul className="flex flex-col divide-y divide-ink-100">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block py-3 text-sm font-medium text-ink-700"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
