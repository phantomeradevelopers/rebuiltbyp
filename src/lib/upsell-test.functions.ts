import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

const Schema = z.object({
  templateName: z.enum(['upsell-go-annual', 'upsell-plus-to-pro']),
  recipientEmail: z.string().email(),
  firstName: z.string().max(60).optional(),
  planKey: z.enum(['plus', 'pro']).optional(),
})

/**
 * Admin-only test hook: send any lifecycle upsell email to a given address.
 * Bypasses the once-per-user-per-campaign guard (does not write to
 * email_campaign_sends) so the same address can be tested repeatedly.
 * Still honors the suppression list.
 */
export const adminTestUpsellEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: roles } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', context.userId).in('role', ['admin', 'coach'])
    if (!roles || roles.length === 0) throw new Error('Not authorized')

    const { enqueueRebuiltEmail } = await import('@/lib/rebuilt-email.server')
    const result = await enqueueRebuiltEmail({
      templateName: data.templateName,
      recipientEmail: data.recipientEmail,
      templateData: {
        firstName: data.firstName,
        planKey: data.planKey ?? (data.templateName === 'upsell-plus-to-pro' ? 'pro' : 'plus'),
      },
      idempotencyKey: `test:${data.templateName}:${data.recipientEmail}:${Date.now()}`,
    })
    return result
  })
