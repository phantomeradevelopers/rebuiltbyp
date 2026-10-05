import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailShell, Pill, CodeBox, GoldButton, brand, main, SITE_URL } from './_shared'

interface Props {
  firstName?: string
}

const Email = ({ firstName = 'brother' }: Props) => {
  const url = `${SITE_URL}/subscribe?code=NEXTLEVEL20&plan=pro`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Ready for the next level? 20% off Pro.</Preview>
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
            Ready for the next level?
          </Heading>
          <Text style={{ margin: 0, color: brand.muted, fontSize: '15px', lineHeight: 1.6 }}>
            {firstName === 'brother' ? 'Hey brother,' : `Hey ${firstName},`}
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            A month on Plus. That's not a trial — that's a decision. You've built the base;
            now it's time to sharpen the edges. Pro unlocks unlimited Coach P, the full
            nutrition academy, member perks, and 1:1 consult access.
          </Text>
          <Text style={{ margin: '14px 0 0', color: brand.text, fontSize: '15px', lineHeight: 1.7 }}>
            Use the code below at checkout for <strong style={{ color: brand.gold }}>20% off Pro</strong>. My way
            of walking you up the next step.
          </Text>

          <CodeBox code="NEXTLEVEL20" label="Your code · 20% off Pro" />

          <Container style={{ textAlign: 'center' as const }}>
            <GoldButton href={url}>Step up to Pro</GoldButton>
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
  subject: 'Ready for the next level? 20% off Pro',
  displayName: 'Upsell · Plus → Pro (NEXTLEVEL20)',
  previewData: { firstName: 'James' },
} satisfies TemplateEntry
