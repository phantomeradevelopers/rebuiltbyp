/**
 * Download route for REBUILT Mogul bonus PDFs.
 *
 * THE CODE is the free signup gift and stays open. The four paid Mogul
 * guides require a signed-in user who either bought the Mogul Bundle / the
 * Course, or holds a paid tier — proven server-side before any signed URL
 * is minted.
 */
import { createFileRoute } from '@tanstack/react-router'
import { ALL_BONUSES, FREE_BONUS_SLUG, type MogulSlug } from '@/lib/mogul-bonuses'

export const Route = createFileRoute('/api/public/mogul-bonuses/$slug')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = params.slug as MogulSlug
        const bonus = ALL_BONUSES.find((b) => b.slug === slug)
        if (!bonus) return new Response('Not found', { status: 404 })

        if (slug !== FREE_BONUS_SLUG) {
          const allowed = await callerMayDownload(request)
          if (!allowed) {
            return new Response(
              'This guide is part of the REBUILT Mogul Bundle. Sign in with the account that purchased it.',
              { status: 403 },
            )
          }
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data, error } = await supabaseAdmin.storage
          .from('mogul-bonuses')
          .createSignedUrl(bonus.file, 60 * 10, { download: bonus.file })
        if (error || !data?.signedUrl) {
          return new Response(`Signing failed: ${error?.message ?? 'unknown'}`, { status: 500 })
        }
        return new Response(null, { status: 302, headers: { Location: data.signedUrl } })
      },
    },
  },
})

/** Bearer token → user → purchase or paid tier. */
async function callerMayDownload(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
  if (!token) return false

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: userRes } = await supabaseAdmin.auth.getUser(token)
  const userId = userRes?.user?.id
  if (!userId) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bought } = await (supabaseAdmin.rpc as any)('has_purchase', {
    _user_id: userId,
    _product_key: 'mogul_bundle',
  })
  if (bought === true) return true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabaseAdmin as any)
    .from('user_profile')
    .select('tier, entitlement')
    .eq('user_id', userId)
    .maybeSingle()
  const tier = profile?.tier as string | undefined
  const entitlement = profile?.entitlement as string | undefined
  return (
    entitlement === 'lifetime' ||
    entitlement === 'subscriber' ||
    tier === 'pro' ||
    tier === 'elite' ||
    tier === 'lifetime_pro'
  )
}
