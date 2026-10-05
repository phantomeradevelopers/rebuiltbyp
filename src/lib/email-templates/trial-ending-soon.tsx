import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, GoldButton, brand, main, SITE_URL } from './_shared'

interface Props {
  firstName?: string
  trialEndDate?: string
  priceLabel?: string
}

const Email = ({ firstName = 'brother', trialEndDate = 'in 2 days', priceLabel = '$14.99/mo' }: Props) => {
  const url = `${SITE_URL}/app/settings`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your REBUILT free month ends {trialEndDate}.</Preview>
      <Body style={main}>
        <EmailShell>
          <Pill>Heads up — 2 days left</Pill>
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
            Your free month ends {trialEndDate}.
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Just a quick heads-up: your 30-day REBUILT free trial ends on{' '}
            <strong style={{ color: brand.text }}>{trialEndDate}</strong>. On that day, your card will
            be charged <strong style={{ color: brand.text }}>{priceLabel}</strong> and Pro keeps
            running.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            If REBUILT is working for you — do nothing. You're set.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.muted, fontSize: '14px', lineHeight: 1.7 }}>
            If it's not the right time, you can cancel any time from Settings and you won't be charged.
          </Text>

          <Container style={{ textAlign: 'center' as const, paddingTop: '18px' }}>
            <GoldButton href={url}>Manage subscription</GoldButton>
          </Container>

          <Hr style={{ borderColor: brand.border, margin: '28px 0 20px' }} />

          <Text style={{ margin: 0, color: brand.muted, fontSize: '12px', lineHeight: 1.7, textAlign: 'center' as const }}>
            Questions? Reply to this email or reach us at{' '}
            <span style={{ color: brand.gold }}>support@e2v.ai</span>.
          </Text>
        </EmailShell>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Heads up: your REBUILT free month ends ${(data.trialEndDate as string) ?? 'in 2 days'}`,
  displayName: 'Trial ending in 2 days',
  previewData: { firstName: 'James', trialEndDate: 'Aug 12', priceLabel: '$14.99/mo' },
} satisfies TemplateEntry
