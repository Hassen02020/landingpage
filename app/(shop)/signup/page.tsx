import Link from "next/link"
import type { Metadata } from "next"
import { SignupForm } from "@/components/auth/SignupForm"

export const metadata: Metadata = { title: "Create Account" }

export default function SignupPage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500">Get 30% off your first order and free shipping over $49.</p>
        <div className="mt-6">
          <SignupForm />
        </div>
        <p className="mt-6 text-sm text-ink-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-forest hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
