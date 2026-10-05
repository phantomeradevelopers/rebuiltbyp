// Shared metadata for the REBUILT bonus stack.
// PDFs live in the private `mogul-bonuses` Storage bucket. Downloads go through
// /api/public/mogul-bonuses/$slug which 302s to a fresh signed URL so links
// stay stable in emails and in the app.
import type { Tier } from '@/lib/tier'

export type MogulSlug =
  | 'the-code'
  | '01-comeback-income-playbook'
  | '02-ai-unfair-advantage'
  | '03-build-your-brand'
  | '04-launch-sprint'

export interface MogulBonus {
  slug: MogulSlug
  number: string
  title: string
  subtitle: string
  file: string // filename in the mogul-bonuses bucket
}

// THE CODE — the free signup gift. Every new user gets this.
export const THE_CODE: MogulBonus = {
  slug: 'the-code',
  number: '00',
  title: "THE CODE",
  subtitle: "12 Rules for a Life You're Proud Of.",
  file: 'the-code.pdf',
}

// The 4 Mogul guides — paid tier only (Pro, Course, 1:1).
export const MOGUL_BONUSES: MogulBonus[] = [
  {
    slug: '01-comeback-income-playbook',
    number: '01',
    title: 'The Comeback Income Playbook',
    subtitle: 'Rebuild your bank account after the wreck.',
    file: '01-comeback-income-playbook.pdf',
  },
  {
    slug: '02-ai-unfair-advantage',
    number: '02',
    title: 'AI Unfair Advantage 2026',
    subtitle: 'The stack that gives you 10x leverage.',
    file: '02-ai-unfair-advantage.pdf',
  },
  {
    slug: '03-build-your-brand',
    number: '03',
    title: 'Build Your Brand 2026',
    subtitle: 'From invisible to inevitable in 90 days.',
    file: '03-build-your-brand.pdf',
  },
  {
    slug: '04-launch-sprint',
    number: '04',
    title: 'The 30-Day Launch Sprint',
    subtitle: 'Ship your first offer, first customer, first check.',
    file: '04-launch-sprint.pdf',
  },
]

// Full lookup — used by the download route and course display.
export const ALL_BONUSES: MogulBonus[] = [THE_CODE, ...MOGUL_BONUSES]

// The one slug that is always free for every signup.
export const FREE_BONUS_SLUG: MogulSlug = 'the-code'

// Standalone Mogul Bundle — the 4 PDF guides for a one-time $99.
// This is a real catalogue price; checkout opens on the single-page Stripe
// checkout every other REBUILT purchase uses.
export const MOGUL_BUNDLE_PRICE_ID = 'mogul_bundle'
export const MOGUL_BUNDLE_PRICE_LABEL = '$99'


export function bonusDownloadUrl(origin: string, slug: MogulSlug): string {
  return `${origin}/api/public/mogul-bonuses/${slug}`
}

/**
 * Tier-based access:
 * - Free (and any non-paid): THE CODE only.
 * - Course, Pro, Elite, Lifetime, 1:1: THE CODE + all 4 Mogul guides.
 */
export function bonusesForTier(tier: Tier, entitlement: 'free' | 'subscriber' | 'lifetime'): MogulBonus[] {
  const fullAccess =
    entitlement === 'lifetime' ||
    entitlement === 'subscriber' ||
    tier === 'pro' ||
    tier === 'elite' ||
    tier === 'lifetime_pro'
  if (fullAccess) return ALL_BONUSES
  return [THE_CODE]
}
