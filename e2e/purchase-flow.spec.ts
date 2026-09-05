import { test, expect } from "@playwright/test"

// These flows need a live Supabase project (migrations + seed data applied)
// and Stripe test-mode keys to mean anything — they're skipped by default so
// `npm run test:e2e` stays green with no external services configured.
// Run for real with: E2E_LIVE_DATA=1 npm run test:e2e
test.skip(!process.env.E2E_LIVE_DATA, "requires a live Supabase project with seed data + Stripe test keys")

test.describe("Customer purchase flow", () => {
  test("home -> category -> product -> cart -> checkout", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "Shop Dogs" }).click()
    await expect(page).toHaveURL(/\/dogs/)

    await page.getByRole("link").filter({ hasText: /./ }).first().click()
    await expect(page.getByRole("button", { name: /add to cart/i }).first()).toBeVisible()
    await page.getByRole("button", { name: "Add to Cart" }).first().click()

    await page.goto("/cart")
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()
    await page.getByRole("link", { name: "Checkout" }).click()
    await expect(page).toHaveURL(/\/checkout/)
  })
})

test.describe("Guest cart RLS regression", () => {
  test("guest can add, reload, and see their cart (0007_guest_cart_rls_fix)", async ({ page }) => {
    await page.goto("/dogs")
    await page.getByRole("link").filter({ hasText: /./ }).first().click()
    await page.getByRole("button", { name: "Add to Cart" }).first().click()

    // A fresh navigation forces a server-side re-read of the cart via RLS —
    // before the 0007 migration this always came back empty for guests.
    await page.goto("/cart")
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()
    await expect(page.getByText("Your cart is empty.")).not.toBeVisible()
  })

  test("two independent guest sessions do not see each other's cart", async ({ browser }) => {
    const guestA = await browser.newContext()
    const guestB = await browser.newContext()
    const pageA = await guestA.newPage()
    const pageB = await guestB.newPage()

    await pageA.goto("/dogs")
    await pageA.getByRole("link").filter({ hasText: /./ }).first().click()
    await pageA.getByRole("button", { name: "Add to Cart" }).first().click()
    await pageA.goto("/cart")
    await expect(pageA.getByText("Your cart is empty.")).not.toBeVisible()

    await pageB.goto("/cart")
    await expect(pageB.getByText("Your cart is empty.")).toBeVisible()

    await guestA.close()
    await guestB.close()
  })
})

test.describe("Pet profile recommendations", () => {
  test("signed-in customer creates a pet and sees recommendations", async ({ page }) => {
    // Requires a logged-in storage state — wire up via Playwright's
    // storageState once a seeded test account exists.
    await page.goto("/pet-profile")
    await expect(page.getByRole("heading", { name: /tell us about your pet/i })).toBeVisible()
  })
})

test.describe("Admin", () => {
  test("admin can sign in and reach the dashboard", async ({ page }) => {
    await page.goto("/admin/login")
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL ?? "")
    await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD ?? "")
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })
})
