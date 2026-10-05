/**
 * Daily lifecycle upsell cron.
 * - go-annual: monthly subs, ~14d in, not already annual, not already sent.
 * - plus-to-pro: plus subs, ~30d in, not on pro yet, not already sent.
 * Each user is emailed at most once per campaign. Suppression respected.
 * Auth: CRON_SECRET (Bearer or x-cron-secret header) — enforced by wrapPublicHandler.
 */
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { wrapPublicHandler } from '@/lib/server-log'

const CAMPAIGN_GO_ANNUAL = 'upsell-go-annual'
const CAMPAIGN_PLUS_TO_PRO = 'upsell-plus-to-pro'

type Sub = {
  user_id: string
  price_id: string | null
  product_id: string | null
  status: string
  current_period_end: string | null
  created_at: string
  environment: string
}

function isAnnual(priceId: string | null) {
  return !!priceId && priceId.endsWith('_annual')
}
function isMonthly(priceId: string | null) {
  return !!priceId && priceId.endsWith('_monthly')
}
function activeStatuses(s: string) {
  return s === 'active' || s === 'trialing' || s === 'past_due'
}

export const Route = createFileRoute('/api/public/hooks/upsell-campaigns')({
  server: {
    handlers: {
      POST: wrapPublicHandler(
        { route: 'hooks/upsell-campaigns', id: 'hooks/upsell-campaigns', perMinute: 5, requireCron: true },
        async () => {
        const supabaseUrl = process.env.SUPABASE_URL!
        const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, svc)
        const { enqueueRebuiltEmail } = await import('@/lib/rebuilt-email.server')

        const now = Date.now()
        const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()

        // Pull subs 12+ days old (covers both 14 and 30 windows with a little slack).
        const { data: subsRaw, error } = await supabase
          .from('subscriptions')
          .select('user_id, price_id, product_id, status, current_period_end, created_at, environment')
          .lte('created_at', daysAgo(12))
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

        const subs = (subsRaw ?? []) as Sub[]
        const goAnnualCandidates: Sub[] = []
        const plusToProCandidates: Sub[] = []
        for (const s of subs) {
          if (!activeStatuses(s.status)) continue
          const ageDays = (now - new Date(s.created_at).getTime()) / 86_400_000
          if (isMonthly(s.price_id) && ageDays >= 14) goAnnualCandidates.push(s)
          if (s.product_id === 'rebuilt_plus' && ageDays >= 30) plusToProCandidates.push(s)
        }

        // Dedupe by user (take latest sub per user for each campaign)
        const latestPerUser = (list: Sub[]) => {
          const map = new Map<string, Sub>()
          for (const s of list) {
            const prev = map.get(s.user_id)
            if (!prev || new Date(s.created_at) > new Date(prev.created_at)) map.set(s.user_id, s)
          }
          return [...map.values()]
        }

        const goAnnual = latestPerUser(goAnnualCandidates)
        const plusToPro = latestPerUser(plusToProCandidates)

        const results = { go_annual: { attempted: 0, sent: 0, skipped: 0 }, plus_to_pro: { attempted: 0, sent: 0, skipped: 0 } }

        async function runCampaign(
          list: Sub[],
          campaign: string,
          templateName: string,
          bucket: { attempted: number; sent: number; skipped: number },
          extraSkip?: (s: Sub, otherLatest: Map<string, Sub>) => boolean,
        ) {
          const proMap = new Map<string, Sub>()
          if (campaign === CAMPAIGN_PLUS_TO_PRO) {
            for (const s of subs) {
              if (s.product_id === 'rebuilt_pro' && activeStatuses(s.status)) {
                proMap.set(s.user_id, s)
              }
            }
          }
          const annualMap = new Map<string, Sub>()
          if (campaign === CAMPAIGN_GO_ANNUAL) {
            for (const s of subs) {
              if (isAnnual(s.price_id) && activeStatuses(s.status)) {
                annualMap.set(s.user_id, s)
              }
            }
          }

          for (const s of list) {
            bucket.attempted++
            if (extraSkip?.(s, campaign === CAMPAIGN_PLUS_TO_PRO ? proMap : annualMap)) {
              bucket.skipped++
              continue
            }
            if (campaign === CAMPAIGN_PLUS_TO_PRO && proMap.has(s.user_id)) { bucket.skipped++; continue }
            if (campaign === CAMPAIGN_GO_ANNUAL && annualMap.has(s.user_id)) { bucket.skipped++; continue }

            const { data: already } = await supabase
              .from('email_campaign_sends').select('id')
              .eq('user_id', s.user_id).eq('campaign', campaign).maybeSingle()
            if (already) { bucket.skipped++; continue }

            const { data: profile } = await supabase
              .from('user_profile').select('email, first_name')
              .eq('user_id', s.user_id).maybeSingle()
            const email = profile?.email as string | undefined
            if (!email) { bucket.skipped++; continue }

            const firstName = (profile?.first_name as string | undefined) || undefined
            const planKey: 'plus' | 'pro' = s.product_id === 'rebuilt_pro' ? 'pro' : 'plus'

            const result = await enqueueRebuiltEmail({
              templateName,
              recipientEmail: email,
              templateData: { firstName, planKey },
              idempotencyKey: `${campaign}:${s.user_id}`,
            })

            await supabase.from('email_campaign_sends').insert({
              user_id: s.user_id,
              campaign,
              recipient_email: email,
              status: result.ok ? 'queued' : `skipped:${(result as { reason?: string }).reason ?? 'error'}`,
              meta: result.ok ? { message_id: result.messageId } : (result as Record<string, unknown>),
            }).select().maybeSingle()

            if (result.ok) bucket.sent++
            else bucket.skipped++
          }
        }

        await runCampaign(goAnnual, CAMPAIGN_GO_ANNUAL, 'upsell-go-annual', results.go_annual)
        await runCampaign(plusToPro, CAMPAIGN_PLUS_TO_PRO, 'upsell-plus-to-pro', results.plus_to_pro)

        return Response.json({ ok: true, results })
        },
      ),
    },
  },
})
