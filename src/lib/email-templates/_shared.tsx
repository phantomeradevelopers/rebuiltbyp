import * as React from 'react'
import { Section, Row, Column, Img, Text, Button, Container } from '@react-email/components'
import mark from '@/assets/rebuilt-mark.png.asset.json'

export const SITE_URL = 'https://rebuiltbyp.com'
export const MARK_URL = `${SITE_URL}${mark.url}`

export const brand = {
  bg: '#0C0C0E',
  panel: '#131316',
  border: '#2A2A30',
  text: '#F2EDE4',
  muted: '#9B958A',
  gold: '#C8A25B',
  goldSoft: '#8A6D3B',
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: 0,
}

export const outer = {
  backgroundColor: '#ffffff',
  padding: '32px 0',
}

export const card = {
  backgroundColor: brand.bg,
  border: `1px solid ${brand.border}`,
  borderRadius: '18px',
  padding: '40px 32px',
  maxWidth: '560px',
  margin: '0 auto',
  color: brand.text,
}

export function BrandHeader() {
  return (
    <Section style={{ paddingBottom: '28px' }}>
      <Row>
        <Column style={{ width: '56px' }}>
          <Img
            src={MARK_URL}
            width="48"
            height="48"
            alt="REBUILT"
            style={{ borderRadius: '11px', display: 'block' }}
          />
        </Column>
        <Column>
          <Text
            style={{
              margin: 0,
              color: brand.text,
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            REBUILT
          </Text>
          <Text
            style={{
              margin: '4px 0 0',
              color: brand.gold,
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.36em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            By P
          </Text>
        </Column>
      </Row>
    </Section>
  )
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <Section style={{ paddingBottom: '20px' }}>
      <Text
        style={{
          display: 'inline-block',
          margin: 0,
          padding: '6px 12px',
          border: `1px solid ${brand.goldSoft}`,
          borderRadius: '999px',
          color: brand.gold,
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </Section>
  )
}

export function CodeBox({ code, label }: { code: string; label: string }) {
  return (
    <Section style={{ padding: '20px 0' }}>
      <div
        style={{
          border: `1.5px dashed ${brand.gold}`,
          borderRadius: '12px',
          padding: '18px 20px',
          textAlign: 'center' as const,
          backgroundColor: '#0F0F12',
        }}
      >
        <Text
          style={{
            margin: 0,
            color: brand.muted,
            fontSize: '10px',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            margin: '8px 0 0',
            color: brand.gold,
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          }}
        >
          {code}
        </Text>
      </div>
    </Section>
  )
}

export function GoldButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ paddingTop: '8px', paddingBottom: '8px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: brand.gold,
          color: '#0C0C0E',
          padding: '14px 26px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        {children}
      </Button>
    </Section>
  )
}

export function CoachSignature() {
  return (
    <Section style={{ paddingTop: '32px', borderTop: `1px solid ${brand.border}`, marginTop: '28px' }}>
      <Text style={{ margin: 0, color: brand.muted, fontSize: '13px', lineHeight: 1.6 }}>
        I've got you.
      </Text>
      <Text
        style={{
          margin: '10px 0 0',
          color: brand.gold,
          fontFamily: '"Brush Script MT", "Snell Roundhand", cursive',
          fontSize: '28px',
          lineHeight: 1,
        }}
      >
        Coach P
      </Text>
      <Text style={{ margin: '6px 0 0', color: brand.muted, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        REBUILT · Founder & Coach
      </Text>
    </Section>
  )
}

export function EmailShell({ children }: { children: React.ReactNode }) {
  return (
    <Container style={outer}>
      <div style={card}>
        <BrandHeader />
        {children}
        <CoachSignature />
      </div>
      <Text
        style={{
          textAlign: 'center' as const,
          color: '#8A8A8A',
          fontSize: '11px',
          margin: '20px auto 0',
          maxWidth: '560px',
        }}
      >
        REBUILT by P · From the wreck to the way back.
      </Text>
    </Container>
  )
}
