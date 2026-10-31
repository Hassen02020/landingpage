// Captcha Cloudflare Turnstile (facultatif) : actif dès que TURNSTILE_SECRET_KEY est défini.
export function captchaEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyCaptcha(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token || token.length > 2048) return false
  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set("remoteip", ip)
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as { success?: boolean }
    return json.success === true
  } catch {
    // service de vérification injoignable : on refuse (le prospect garde le lien WhatsApp)
    return false
  }
}
