import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"

// A syntactically valid but unreachable placeholder. Supabase's client
// constructor throws synchronously on an empty URL/key (crashing every page
// that renders before secrets are configured); a non-empty placeholder lets
// construction succeed so the failure surfaces as an ordinary async
// {data, error} network failure instead, which callers already handle.
const PLACEHOLDER_URL = "https://placeholder.supabase.co"
const PLACEHOLDER_KEY = "placeholder"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component; ignored because
            // middleware refreshes the session on every request.
          }
        },
      },
    }
  )
}

/** Service-role client for trusted server-only operations (webhooks, admin jobs). Never expose to the client. */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_KEY,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
