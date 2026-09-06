import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { getCart } from "@/lib/data/cart"

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const cart = await getCart()

  return (
    <div className="flex min-h-screen flex-col">
      <Header cartCount={cart.itemCount} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
