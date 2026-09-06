import Image from "next/image"
import { ButtonLink } from "@/components/ui/Button"

const PETS = [
  {
    label: "Dogs",
    emoji: "🐶",
    href: "/dogs",
    cta: "Shop Dog Products",
    image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=1000",
  },
  {
    label: "Cats",
    emoji: "🐱",
    href: "/cats",
    cta: "Shop Cat Products",
    image: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=1000",
  },
]

export function ShopByPet() {
  return (
    <section className="container py-10">
      <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Everything Your Pet Needs</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {PETS.map((pet) => (
          <div key={pet.href} className="group relative overflow-hidden rounded-3xl">
            <div className="relative aspect-[4/3]">
              <Image
                src={pet.image}
                alt={`${pet.label} products`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/10 to-transparent" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-6">
              <span className="text-3xl">{pet.emoji}</span>
              <h3 className="mt-1 font-display text-2xl font-bold text-white">{pet.label.toUpperCase()}</h3>
              <ButtonLink href={pet.href} variant="secondary" size="sm" className="mt-3">
                {pet.cta}
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
