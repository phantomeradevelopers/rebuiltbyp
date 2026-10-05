import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, GoldButton, brand, main, SITE_URL } from './_shared'
import { ALL_BONUSES, THE_CODE, bonusDownloadUrl } from '@/lib/mogul-bonuses'

interface Props {
  firstName?: string
  /** 'full' = all 4 guides (Course/Pro/Elite/1:1), 'free' = just Guide 02 taster */
  bonusAccess?: 'full' | 'free'
}

const Email = ({ firstName = 'brother', bonusAccess = 'free' }: Props) => {
  const url = `${SITE_URL}/app`
  const bonuses = bonusAccess === 'full' ? ALL_BONUSES : [THE_CODE]

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to REBUILT. From the wreck to the way back.</Preview>
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
            Welcome in.
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            You made the call most men never make. That's the first rep. Everything else
            we build together — training, nutrition, mindset, faith — starts from right here.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Your 30-day plan is loaded. Open the app, run today's work, and check in when
            you're done. That's the loop. Small, daily, non-negotiable.
          </Text>

          <Container style={{ textAlign: 'center' as const, paddingTop: '18px' }}>
            <GoldButton href={url}>Open REBUILT</GoldButton>
          </Container>

          <Hr style={{ borderColor: brand.border, margin: '28px 0 20px' }} />

          <Pill>
            {bonusAccess === 'full' ? 'Your full bonus stack — 5 guides unlocked' : 'Your free signup gift'}
          </Pill>
          <Text style={{ margin: '10px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            {bonusAccess === 'full'
              ? "THE CODE plus the full REBUILT Mogul stack. Save them, print them, run them."
              : "THE CODE — 12 rules for a life you're proud of. The four Mogul guides (Income, AI, Brand, Sprint) unlock with Pro, the Course, or 1:1."}
          </Text>


          <Section style={{ paddingTop: '14px' }}>
            {bonuses.map((b) => {
              // THE CODE downloads straight from the email; the paid guides
              // open in the app so ownership is checked before the file.
              const href =
                b.slug === 'the-code'
                  ? bonusDownloadUrl(SITE_URL, b.slug)
                  : `${SITE_URL}/app/nutrition/mogul-bonuses`
              return (
                <div
                  key={b.slug}
                  style={{
                    border: `1px solid ${brand.border}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    margin: '0 0 10px',
                    backgroundColor: '#0F0F12',
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      color: brand.gold,
                      fontSize: '10px',
                      letterSpacing: '0.28em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {b.slug === 'the-code' ? 'The Code' : `Mogul ${b.number}`}
                  </Text>
                  <Text
                    style={{
                      margin: '4px 0 4px',
                      color: brand.text,
                      fontSize: '15px',
                      fontWeight: 700,
                      lineHeight: 1.35,
                    }}
                  >
                    {b.title}
                  </Text>
                  <Text style={{ margin: '0 0 8px', color: brand.muted, fontSize: '12px', lineHeight: 1.5 }}>
                    {b.subtitle}
                  </Text>
                  <a
                    href={href}
                    style={{
                      color: brand.gold,
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      textDecoration: 'none',
                    }}
                  >
                    Download PDF →
                  </a>
                </div>
              )
            })}
          </Section>

          <Text style={{ margin: '22px 0 0', color: brand.muted, fontSize: '12px', lineHeight: 1.7, textAlign: 'center' as const }}>
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
  subject: 'Welcome in — your REBUILT plan is loaded',
  displayName: 'Welcome',
  previewData: { firstName: 'James', bonusAccess: 'full' },
} satisfies TemplateEntry
