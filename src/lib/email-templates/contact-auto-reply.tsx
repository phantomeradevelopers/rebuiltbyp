import * as React from 'react'
import { Body, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, brand, main } from './_shared'

interface Props {
  firstName?: string
}

const Email = ({ firstName = 'brother' }: Props) => {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Got your note — Coach P will get back to you.</Preview>
      <Body style={main}>
        <EmailShell>
          <Pill>From the wreck to the way back</Pill>
          <Heading
            style={{
              margin: '4px 0 12px',
              color: brand.text,
              fontFamily: '"Bebas Neue", Impact, sans-serif',
              fontSize: '38px',
              lineHeight: 1.05,
              letterSpacing: '0.02em',
            }}
          >
            Got your note.
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Your message landed. I read every one myself — usually inside 24 hours,
            sometimes faster. If it's urgent, reply to this email and put{' '}
            <strong style={{ color: brand.gold }}>URGENT</strong> in the subject.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            In the meantime — keep moving. One rep, one meal, one check-in. That's how
            we build the way back.
          </Text>

          <Text style={{ margin: '22px 0 0', color: brand.muted, fontSize: '12px', lineHeight: 1.7, textAlign: 'center' as const }}>
            Support: <span style={{ color: brand.gold }}>support@e2v.ai</span> ·{' '}
            <span style={{ color: brand.gold }}>rebuiltbyp.com</span>
          </Text>
        </EmailShell>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Got your note — Coach P',
  displayName: 'Contact · auto-reply',
  previewData: { firstName: 'James' },
} satisfies TemplateEntry
