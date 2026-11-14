"use client"

// Avis des visiteurs (page Omra). N'affiche QUE les avis publiés par l'équipe ; aucune note n'est inventée :
// sans avis publié, aucune moyenne n'apparaît. Un avis déposé reste « en attente » tant que l'équipe ne l'a pas validé.
import { useEffect, useState } from "react"

interface PublicReview { rating: number; name: string; comment: string | null; created_at: string }
interface Published { count: number; average: number | null; reviews: PublicReview[] }

const T = {
  title: "آراء الزوار",
  sub: "تقييمات حقيقية يتركها زوار الموقع، تظهر بعد مراجعتها من فريقنا.",
  average: (a: number, n: number) => `${a.toLocaleString("en-US", { minimumFractionDigits: 1 })} / 5 · ${n} ${n === 1 ? "تقييم" : "تقييمات"}`,
  none: "لا توجد تقييمات منشورة بعد. كن أول من يقيّم.",
  formTitle: "شاركنا رأيك",
  rating: "تقييمك",
  star: (n: number) => `${n} من 5`,
  name: "الاسم الأول",
  comment: "تعليقك (اختياري)",
  consent: "أوافق على نشر اسمي الأول وتعليقي بعد مراجعتهما من فريق Easy2Book.",
  send: "إرسال تقييمي",
  sending: "جارٍ الإرسال…",
  thanks: "شكراً لك! سيظهر تقييمك بعد مراجعته من فريقنا.",
  fail: "تعذر إرسال التقييم. حاول لاحقاً.",
  many: "تم إرسال عدد كبير من التقييمات. حاول لاحقاً.",
}

export function ReviewsSection({ page = "omra" }: { page?: string }) {
  const [data, setData] = useState<Published | null>(null)
  const [rating, setRating] = useState(0)
  const [name, setName] = useState("")
  const [comment, setComment] = useState("")
  const [website, setWebsite] = useState("")
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")

  useEffect(() => {
    let alive = true
    fetch(`/api/reviews?page=${encodeURIComponent(page)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Published | null) => { if (alive && d && Array.isArray(d.reviews)) setData(d) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [page])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === "sending") return
    setState("sending"); setErrors({}); setMessage("")
    try {
      const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page, rating, name, comment, consent, website, lang: "ar" }) })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; errors?: Record<string, string> }
      if (res.ok && body.ok) { setState("done"); return }
      if (res.status === 400 && body.errors) { setErrors(body.errors); setState("idle"); return }
      setMessage(res.status === 429 ? T.many : T.fail); setState("error")
    } catch {
      setMessage(T.fail); setState("error")
    }
  }

  const field = "w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
  const has = data && data.count > 0
  return (
    <section id="avis" className="scroll-mt-16 py-12 sm:py-16 bg-white" aria-labelledby="avis-titre" data-testid="reviews">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-6">
          <h2 id="avis-titre" className="text-2xl sm:text-3xl font-black mb-2">{T.title}</h2>
          <p className="text-gray-600 text-sm">{T.sub}</p>
          {has && data.average !== null && (
            <p className="mt-3 text-lg font-black text-emerald-800" data-testid="reviews-average">
              <span className="text-amber-500" aria-hidden="true">★</span> <span dir="ltr">{T.average(data.average, data.count)}</span>
            </p>
          )}
        </div>

        {has ? (
          <ul className="grid gap-3 mb-10" data-testid="reviews-list">
            {data.reviews.map((r, i) => (
              <li key={`${r.created_at}-${i}`} className="rounded-2xl border border-gray-200 bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-500 text-lg" role="img" aria-label={T.star(r.rating)}>{"★".repeat(r.rating)}<span className="text-gray-300">{"★".repeat(5 - r.rating)}</span></span>
                  <strong>{r.name}</strong>
                </div>
                {r.comment && <p className="mt-2 text-gray-800 whitespace-pre-line leading-relaxed" dir="auto">{r.comment}</p>}
              </li>
            ))}
          </ul>
        ) : (
          data && <p className="text-center text-gray-500 mb-8" data-testid="reviews-empty">{T.none}</p>
        )}

        <div className="rounded-3xl bg-emerald-50 p-5 sm:p-6">
          <h3 className="text-xl font-black mb-4">{T.formTitle}</h3>
          {state === "done" ? (
            <p role="status" className="font-bold text-emerald-800" data-testid="reviews-thanks">{T.thanks}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate data-testid="reviews-form">
              <fieldset>
                <legend className="font-bold mb-2">{T.rating} <span aria-hidden="true">*</span></legend>
                <div className="flex gap-1 text-3xl" dir="ltr">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="cursor-pointer">
                      <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only peer" aria-label={T.star(n)} />
                      <span className={`${n <= rating ? "text-amber-500" : "text-gray-300"} peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 rounded`} aria-hidden="true">★</span>
                    </label>
                  ))}
                </div>
                {errors.rating && <p className="text-sm text-red-700 mt-1" role="alert">{errors.rating}</p>}
              </fieldset>
              <div>
                <label htmlFor="avis-nom" className="block font-bold mb-1">{T.name} <span aria-hidden="true">*</span></label>
                <input id="avis-nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" className={field} />
                {errors.name && <p className="text-sm text-red-700 mt-1" role="alert">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="avis-com" className="block font-bold mb-1">{T.comment}</label>
                <textarea id="avis-com" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={3} className={field} />
                {errors.comment && <p className="text-sm text-red-700 mt-1" role="alert">{errors.comment}</p>}
              </div>
              {/* champ piège : invisible pour un visiteur, rempli par un robot */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                <span>{T.consent} <span aria-hidden="true">*</span></span>
              </label>
              {errors.consent && <p className="text-sm text-red-700" role="alert">{errors.consent}</p>}
              {state === "error" && <p className="text-sm text-red-700" role="alert">{message}</p>}
              <button type="submit" disabled={state === "sending"} className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-6 py-3 rounded-2xl disabled:opacity-60">
                {state === "sending" ? T.sending : T.send}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
