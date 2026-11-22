// État des canaux (lot C) : lecture seule des faits (intégrations, numéros WhatsApp, journal des événements entrants, leads, conversations).
// Aucune écriture, aucun appel aux plateformes, aucun événement artificiel.
import { select } from "@/lib/server/db"
import { selectRealLeads } from "@/lib/server/lead-scope"
import { loadInboundJournal } from "@/lib/server/inbound-events"
import { channelReport, type ChannelFacts, type ChannelId, type ChannelReport } from "@/lib/channel-status"

const none = (): ChannelFacts => ({ configured: false, lastEventAt: null, events7d: 0, dropped7d: 0, lastTestOk: null, lastTestAt: null })
const safe = async <T>(p: Promise<T[]>): Promise<T[]> => { try { return await p } catch { return [] } } // table absente : fait inconnu, jamais une erreur de page

export async function loadChannelReports(orgId: string, now: Date = new Date()): Promise<ChannelReport[]> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const [journal, integrations, numbers, formLeads, convs, sent] = await Promise.all([
    loadInboundJournal(orgId, 1),
    safe(select<{ provider: string; enabled: boolean; last_test_ok: boolean | null; last_test_at: string | null }>("landing_integrations", "select=provider,enabled,last_test_ok,last_test_at")),
    safe(select<{ enabled: boolean }>("landing_whatsapp_numbers", "select=enabled&enabled=eq.true&limit=1")),
    safe(selectRealLeads<{ created_at: string }>(`select=created_at&source=eq.form&order=created_at.desc&limit=200`)),
    safe(select<{ channel: string; started_at: string; conversation_count: number }>("landing_conversations", `select=channel,started_at,conversation_count&status=neq.annulee&is_test=eq.false&started_at=gte.${encodeURIComponent(since)}&order=started_at.desc&limit=500`)),
    safe(select<{ sent_at: string | null }>("landing_conversion_log", "select=sent_at&status=eq.sent&order=sent_at.desc&limit=50")),
  ])
  const h = (p: string) => journal.health.find((x) => x.platform === p)
  const integ = (p: string) => integrations.find((i) => i.provider === p)
  const wa = h("whatsapp"), fb = h("facebook"), ig = h("instagram"), tt = h("tiktok")
  const inboundFacts = (health: typeof wa, configured: boolean): ChannelFacts => ({ ...none(), configured, lastEventAt: health?.lastAt ?? null, events7d: (health?.created ?? 0) + (health?.duplicate ?? 0), dropped7d: health?.dropped ?? 0 })
  const meta = integ("meta"), tik = integ("tiktok")
  const facts: Record<ChannelId, ChannelFacts> = {
    formulaires: { ...none(), configured: true, lastEventAt: formLeads[0]?.created_at ?? null, events7d: formLeads.filter((l) => l.created_at >= since).length },
    whatsapp: inboundFacts(wa, numbers.length > 0),
    messenger: inboundFacts(fb, false),
    instagram: inboundFacts(ig, false),
    telephone: { ...none(), configured: true, manual: true, lastEventAt: convs.find((c) => c.channel === "telephone")?.started_at ?? null, events7d: convs.filter((c) => c.channel === "telephone").reduce((n, c) => n + c.conversation_count, 0) },
    meta_conversions: { ...none(), configured: Boolean(meta?.enabled), lastEventAt: sent[0]?.sent_at ?? null, events7d: sent.filter((s) => s.sent_at && s.sent_at >= since).length, lastTestOk: meta?.last_test_ok ?? null, lastTestAt: meta?.last_test_at ?? null },
    tiktok: { ...inboundFacts(tt, Boolean(tik?.enabled)), lastTestOk: tik?.last_test_ok ?? null, lastTestAt: tik?.last_test_at ?? null },
  }
  return (Object.keys(facts) as ChannelId[]).map((id) => channelReport(id, facts[id], now))
}
