import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, GoldButton, brand, main, SITE_URL } from './_shared'

interface Props {
  firstName?: string
  productName?: string
  priceLabel?: string
  /** Plain list of what the buyer now has access to. */
  items?: string[]
  ctaLabel?: string
  ctaPath?: string
}

const Email = ({
  firstName = 'brother',
  productName = 'REBUILT Mogul Bundle',
  priceLabel = '$99',
  items = [
    'The Operator Mindset',
    'The Money Machine',
    'The Body Is The Business',
    'The 30-Day Launch Sprint',
  ],
  ctaLabel = 'Open your guides',
  ctaPath = '/app/nutrition/mogul-bonuses',
}: Props) => {
  const url = `${SITE_URL}${ctaPath}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your purchase is unlocked. Here's everything you just got.</Preview>
      <Body style={main}>
        <EmailShell>
          <Pill>Purchase confirmed</Pill>
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
            It's yours.
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Your payment for <strong>{productName}</strong> ({priceLabel}) came through and your
            access is already unlocked inside REBUILT.
          </Text>

          <Container
            style={{
              margin: '18px 0 0',
              padding: '14px 16px',
              border: `1px solid ${brand.border}`,
              borderRadius: '10px',
            }}
          >
            {items.map((it) => (
              <Text key={it} style={{ margin: '4px 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
                — {it}
              </Text>
            ))}
          </Container>

          <Text style={{ margin: '16px 0 0', color: brand.muted, fontSize: '14px', lineHeight: 1.7 }}>
            This was a single one-time charge. It does not renew and you will not be billed again.
            Your bank statement will read <strong>EEE INTL* REBUILT</strong>.
          </Text>

          <Container style={{ textAlign: 'center' as const, paddingTop: '18px' }}>
            <GoldButton href={url}>{ctaLabel}</GoldButton>
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
  subject: 'Your REBUILT purchase — unlocked',
  displayName: 'Purchase delivered (one-time products)',
  previewData: {
    firstName: 'James',
    productName: 'REBUILT Mogul Bundle',
    priceLabel: '$99',
  },
} satisfies TemplateEntry
