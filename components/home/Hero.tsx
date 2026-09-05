import Image from "next/image"
import { ButtonLink } from "@/components/ui/Button"

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-sand-200">
      <div className="container grid items-center gap-8 py-12 lg:grid-cols-2 lg:py-20">
        <div className="relative z-10 max-w-xl">
          <h1 className="font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
            Better Care.
            <br />
            Happier Pets.
          </h1>
          <p className="mt-5 text-base text-ink-600 sm:text-lg">
            Premium food, treats and everyday essentials for the pets you love — delivered to your door.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/dogs" size="lg">Shop Dogs</ButtonLink>
            <ButtonLink href="/cats" variant="outline" size="lg">Shop Cats</ButtonLink>
          </div>
          <ButtonLink href="/pet-profile" variant="ghost" size="md" className="mt-2 px-0 text-forest underline underline-offset-4 hover:bg-transparent">
            Find the Right Food →
          </ButtonLink>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl lg:aspect-square">
          <Image
            src="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1400"
            alt="Happy dog and cat with PETORA essentials"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  )
}
