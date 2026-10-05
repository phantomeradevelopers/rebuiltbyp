import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as upsellGoAnnual } from './upsell-go-annual'
import { template as upsellPlusToPro } from './upsell-plus-to-pro'
import { template as welcomeTpl } from './welcome'
import { template as contactAutoReply } from './contact-auto-reply'
import { template as trialEndingSoon } from './trial-ending-soon'
import { template as subscriptionConfirmed } from './subscription-confirmed'
import { template as renewalReminder } from './renewal-reminder'
import { template as purchaseDelivered } from './purchase-delivered'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'upsell-go-annual': upsellGoAnnual,
  'upsell-plus-to-pro': upsellPlusToPro,
  'welcome': welcomeTpl,
  'contact-auto-reply': contactAutoReply,
  'trial-ending-soon': trialEndingSoon,
  'subscription-confirmed': subscriptionConfirmed,
  'renewal-reminder': renewalReminder,
  'purchase-delivered': purchaseDelivered,
}
