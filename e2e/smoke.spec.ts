import { test, expect } from "@playwright/test"

// Structural smoke tests — these must pass with no live Supabase/Stripe
// data, so they only assert page shell, routing and auth gating.
// See e2e/purchase-flow.spec.ts for the tests that need seeded data.

test("homepage renders the PETORA shell", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "PETORA" }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: /better care/i })).toBeVisible()
})

test("login page renders and rejects an empty submit", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
})

test("signup page renders", async ({ page }) => {
  await page.goto("/signup")
  await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible()
})

test("admin login is a standalone page (no dashboard chrome)", async ({ page }) => {
  await page.goto("/admin/login")
  await expect(page.getByText("PETORA Admin")).toBeVisible()
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0)
})

test("admin routes redirect to admin login when signed out", async ({ page }) => {
  await page.goto("/admin/dashboard")
  await expect(page).toHaveURL(/\/admin\/login/)
})

test("account routes redirect to login when signed out", async ({ page }) => {
  await page.goto("/account/orders")
  await expect(page).toHaveURL(/\/login/)
})

test("checkout redirects to cart when the cart is empty", async ({ page }) => {
  await page.goto("/checkout")
  await expect(page).toHaveURL(/\/cart/)
})

test("unknown product slug 404s", async ({ page }) => {
  const response = await page.goto("/product/does-not-exist")
  expect(response?.status()).toBe(404)
})

test("blog index and a post render", async ({ page }) => {
  await page.goto("/blog")
  await expect(page.getByRole("heading", { name: "PETORA Blog" })).toBeVisible()
  await page.getByRole("link", { name: /best dog food/i }).click()
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})

test("robots.txt and sitemap.xml are served", async ({ page, request }) => {
  const robots = await request.get("/robots.txt")
  expect(robots.status()).toBe(200)
  const sitemap = await request.get("/sitemap.xml")
  expect(sitemap.status()).toBe(200)
})
