import { PawPrint } from "lucide-react"
import { ButtonLink } from "@/components/ui/Button"

export function PetProfileTeaser() {
  return (
    <section className="container py-10">
      <div className="flex flex-col items-start gap-6 rounded-3xl bg-forest-50 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-white">
            <PawPrint size={22} />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Tell us about your pet</h2>
            <p className="mt-1 max-w-md text-sm text-ink-600">
              Share your pet&apos;s breed, age, weight and preferences — we&apos;ll recommend food and essentials made for them.
            </p>
          </div>
        </div>
        <ButtonLink href="/pet-profile" size="md" className="shrink-0">
          Get Recommendations
        </ButtonLink>
      </div>
    </section>
  )
}
