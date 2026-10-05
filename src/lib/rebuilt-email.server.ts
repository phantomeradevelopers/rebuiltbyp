/**
 * Shared helper for enqueueing REBUILT lifecycle emails.
 * Server-only. Renders a registered template and enqueues it via pgmq
 * on the transactional_emails queue, honoring the suppression list.
 */
import * as React from 'react'
import { render } from '@react-email/render'
import { createClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'REBUILT'
const SENDER_DOMAIN = 'notify.rebuiltbyp.com'
const FROM_DOMAIN = 'rebuiltbyp.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type EnqueueResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: 'suppressed' | 'unknown_template' | 'error'; error?: string }

export async function enqueueRebuiltEmail(opts: {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, unknown>
  idempotencyKey?: string
}): Promise<EnqueueResult> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return { ok: false, reason: 'error', error: 'server_env_missing' }

  const template = TEMPLATES[opts.templateName]
  if (!template) return { ok: false, reason: 'unknown_template' }

  const supabase = createClient(supabaseUrl, serviceKey)
  const to = (template.to || opts.recipientEmail).toLowerCase()
  const messageId = crypto.randomUUID()
  const idempotencyKey = opts.idempotencyKey || messageId

  const { data: suppressed } = await supabase
    .from('suppressed_emails').select('id').eq('email', to).maybeSingle()
  if (suppressed) return { ok: false, reason: 'suppressed' }

  // Reuse or mint an unsubscribe token per email.
  let unsubscribeToken: string
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', to).maybeSingle()
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token
  } else {
    unsubscribeToken = generateToken()
    await supabase.from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: to }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens').select('token').eq('email', to).maybeSingle()
    if (stored?.token) unsubscribeToken = stored.token
  }

  const element = React.createElement(template.component, opts.templateData ?? {})
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof template.subject === 'function'
    ? template.subject(opts.templateData ?? {})
    : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: to,
    status: 'pending',
  })

  const { error: enqueueErr } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to,
      from: `${SITE_NAME} <coach@${FROM_DOMAIN}>`,
      reply_to: 'support@e2v.ai',
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: opts.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueErr) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: to,
      status: 'failed',
      error_message: enqueueErr.message,
    })
    return { ok: false, reason: 'error', error: enqueueErr.message }
  }

  return { ok: true, messageId }
}
