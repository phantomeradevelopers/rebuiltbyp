import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, GoldButton, brand, main, SITE_URL } from './_shared'

interface Props {
  firstName?: string
  planLabel?: string
  amountLabel?: string
  chargeDate?: string
}

const Email = ({
  firstName = 'brother',
  planLabel = 'REBUILT Pro — Monthly',
  amountLabel = '$14.99',
  chargeDate = 'in 3 days',
}: Props) => {
  const url = `${SITE_URL}/app/settings`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Heads up — your REBUILT renewal charges {chargeDate}.</Preview>
      <Body style={main}>
        <EmailShell>
          <Pill>Renewal notice</Pill>
          <Heading
            style={{
              margin: '4px 0 12px',
              color: brand.text,
              fontFamily: '"Bebas Neue", Impact, sans-serif',
              fontSize: '34px',
              lineHeight: 1.05,
              letterSpacing: '0.02em',
            }}
          >
            {amountLabel} on {chargeDate}.
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Your <strong>{planLabel}</strong> renews automatically. We'll charge{' '}
            <strong>{amountLabel}</strong> on <strong>{chargeDate}</strong>. It shows up on your
            statement as <strong>EEE INTL* REBUILT</strong>.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Want to keep going? Do nothing.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.muted, fontSize: '14px', lineHeight: 1.7 }}>
            Want to stop? Cancel in one step from Settings before that date. You keep access through
            the period you already paid for.
          </Text>

          <Container style={{ textAlign: 'center' as const, paddingTop: '18px' }}>
            <GoldButton href={url}>Manage or cancel</GoldButton>
          </Container>

          <Hr style={{ borderColor: brand.border, margin: '28px 0 20px' }} />

          <Text style={{ margin: 0, color: brand.muted, fontSize: '12px', lineHeight: 1.7, textAlign: 'center' as const }}>
            EEE International LLC · 888 Prospect St Suite 200, La Jolla, CA 92037 ·{' '}
            <span style={{ color: brand.gold }}>support@e2v.ai</span>
          </Text>
        </EmailShell>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Renewal notice: ${(data.amountLabel as string) ?? '$14.99'} on ${(data.chargeDate as string) ?? 'your renewal date'}`,
  displayName: 'Renewal reminder (pre-charge)',
  previewData: {
    firstName: 'James',
    planLabel: 'REBUILT Pro — Monthly',
    amountLabel: '$14.99',
    chargeDate: 'Sep 3, 2026',
  },
} satisfies TemplateEntry
