import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, GoldButton, brand, main, SITE_URL } from './_shared'

interface Props {
  firstName?: string
  planLabel?: string
  priceLabel?: string
  renewalTerms?: string
  firstChargeDate?: string
}

const Email = ({
  firstName = 'brother',
  planLabel = 'REBUILT Pro — Monthly',
  priceLabel = '$14.99/month',
  renewalTerms = 'Your first 30 days are free. After the trial, REBUILT Pro renews automatically at $14.99 per month until you cancel.',
  firstChargeDate = 'in 30 days',
}: Props) => {
  const url = `${SITE_URL}/app/settings`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You're in. Here are your REBUILT subscription terms in writing.</Preview>
      <Body style={main}>
        <EmailShell>
          <Pill>Subscription confirmed</Pill>
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
            You're in.
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            This is your written acknowledgement of the plan you signed up for.
          </Text>

          <Container
            style={{
              margin: '18px 0 0',
              padding: '14px 16px',
              border: `1px solid ${brand.border}`,
              borderRadius: '10px',
            }}
          >
            <Text style={{ margin: 0, color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
              <strong>Plan:</strong> {planLabel}
              <br />
              <strong>Price:</strong> {priceLabel}
              <br />
              <strong>First charge:</strong> {firstChargeDate}
              <br />
              <strong>Statement:</strong> EEE INTL* REBUILT
            </Text>
          </Container>

          <Text style={{ margin: '16px 0 0', color: brand.muted, fontSize: '14px', lineHeight: 1.7 }}>
            {renewalTerms}
          </Text>
          <Text style={{ margin: '10px 0 0', color: brand.muted, fontSize: '14px', lineHeight: 1.7 }}>
            Cancel any time in one step from Settings — no phone call, no email required. You keep
            access through the end of the period you already paid for. We do not refund periods
            already billed and we do not prorate.
          </Text>

          <Container style={{ textAlign: 'center' as const, paddingTop: '18px' }}>
            <GoldButton href={url}>Manage subscription</GoldButton>
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
  subject: 'Your REBUILT subscription — confirmed',
  displayName: 'Subscription confirmed (ARL acknowledgement)',
  previewData: {
    firstName: 'James',
    planLabel: 'REBUILT Pro — Monthly',
    priceLabel: '$14.99/month',
    firstChargeDate: 'Sep 3, 2026',
  },
} satisfies TemplateEntry
