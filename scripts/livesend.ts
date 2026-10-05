import * as React from 'react'
import { render } from '@react-email/render'
import { createClient } from '@supabase/supabase-js'
import { template as goAnnual } from '../src/lib/email-templates/upsell-go-annual'
import { template as plusToPro } from '../src/lib/email-templates/upsell-plus-to-pro'
import { template as welcomeTpl } from '../src/lib/email-templates/welcome'
import { template as contactAutoReply } from '../src/lib/email-templates/contact-auto-reply'

const TO = 'eeeinternationalllc@gmail.com'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function tok(){const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('')}

let unsub: string
const { data: ex } = await supabase.from('email_unsubscribe_tokens').select('token,used_at').eq('email', TO).maybeSingle()
if (ex && !ex.used_at) unsub = ex.token
else {
  unsub = tok()
  await supabase.from('email_unsubscribe_tokens').upsert({ token: unsub, email: TO }, { onConflict: 'email', ignoreDuplicates: true })
  const { data: s } = await supabase.from('email_unsubscribe_tokens').select('token').eq('email', TO).maybeSingle()
  if (s?.token) unsub = s.token
}

const jobs = [
  { name: 'contact-auto-reply', tpl: contactAutoReply, data: { firstName: 'Phantom Era' } },
  { name: 'welcome', tpl: welcomeTpl, data: { firstName: 'Phantom Era' } },
  { name: 'upsell-go-annual', tpl: goAnnual, data: { firstName: 'Phantom Era', planKey: 'plus' } },
  { name: 'upsell-plus-to-pro', tpl: plusToPro, data: { firstName: 'Phantom Era' } },
]

for (const j of jobs) {
  const messageId = crypto.randomUUID()
  const el = React.createElement(j.tpl.component, j.data as any)
  const html = await render(el)
  const text = await render(el, { plainText: true })
  const subject = typeof j.tpl.subject === 'function' ? j.tpl.subject(j.data) : j.tpl.subject
  await supabase.from('email_send_log').insert({ message_id: messageId, template_name: j.name, recipient_email: TO, status: 'pending' })
  const { data: res, error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId, to: TO,
      from: 'REBUILT <coach@rebuiltbyp.com>',
      reply_to: 'support@e2v.ai',
      sender_domain: 'notify.rebuiltbyp.com',
      subject, html, text,
      purpose: 'transactional', label: j.name,
      idempotency_key: `livetest2:${j.name}:${Date.now()}`,
      unsubscribe_token: unsub,
      queued_at: new Date().toISOString(),
    },
  })
  console.log(JSON.stringify({ template: j.name, messageId, msg_id: res, error: error?.message }))
}
