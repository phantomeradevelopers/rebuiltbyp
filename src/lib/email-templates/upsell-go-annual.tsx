import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, CodeBox, GoldButton, brand, main, SITE_URL } from './_shared'

interface Props {
  firstName?: string
  planKey?: 'plus' | 'pro'
}

const Email = ({ firstName = 'brother', planKey = 'plus' }: Props) => {
  const url = `${SITE_URL}/subscribe?code=ALLIN&cycle=annual&plan=${planKey}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Two months on the house. Lock in annual.</Preview>
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
            Two months on the house.
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Two weeks in. You're not testing the water anymore — you're building the habit.
            The men who go the distance stop paying monthly and commit to the year. That's
            the version of you I want to see.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Use the code below at checkout. It's <strong style={{ color: brand.gold }}>two months free</strong> on
            the annual plan — no gimmicks, my thanks for showing up.
          </Text>

          <CodeBox code="ALLIN" label="Your code · 2 months free on annual" />

          <Container style={{ textAlign: 'center' as const }}>
            <GoldButton href={url}>Lock in the year</GoldButton>
          </Container>

          <Text style={{ margin: '18px 0 0', color: brand.muted, fontSize: '12px', lineHeight: 1.6, textAlign: 'center' as const }}>
            Code auto-applies at checkout. Cancel anytime.
          </Text>
        </EmailShell>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Two months on the house — lock in annual',
  displayName: 'Upsell · Monthly → Annual (ALLIN)',
  previewData: { firstName: 'James', planKey: 'plus' },
} satisfies TemplateEntry
