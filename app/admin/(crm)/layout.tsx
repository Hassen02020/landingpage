import { redirect } from "next/navigation"
import { currentStaff } from "@/lib/server/auth"
import { currentPlatformAdmin } from "@/lib/server/platform"
import { AdminShell } from "./_components/AdminShell"

export const dynamic = "force-dynamic"

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff()
  if (!staff) redirect((await currentPlatformAdmin()) ? "/admin/plateforme" : "/admin/login")
  return (
    <AdminShell email={staff.email} name={staff.fullName} role={staff.orgRole} orgName={staff.organizationName} orgSlug={staff.organizationSlug}>
      {children}
    </AdminShell>
  )
}
