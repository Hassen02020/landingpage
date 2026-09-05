import Link from "next/link"
import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/LoginForm"

export const metadata: Metadata = { title: "Sign In" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-ink">Sign in to PETORA</h1>
        <p className="mt-1 text-sm text-ink-500">Track orders, manage Autoship, and save your pets&apos; profiles.</p>
        <div className="mt-6">
          <LoginForm redirectTo={redirect} />
        </div>
        <p className="mt-6 text-sm text-ink-500">
          New to PETORA?{" "}
          <Link href="/signup" className="font-medium text-forest hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
