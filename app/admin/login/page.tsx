import type { Metadata } from "next"
import { AdminLoginForm } from "@/components/auth/AdminLoginForm"

export const metadata: Metadata = { title: "Admin Sign In" }

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-popover">
        <span className="font-display text-xl font-bold text-forest">PETORA Admin</span>
        <p className="mt-1 text-sm text-ink-500">Sign in to manage the store.</p>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  )
}
