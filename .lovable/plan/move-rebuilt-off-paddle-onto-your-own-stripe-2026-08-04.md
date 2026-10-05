# Move REBUILT off Paddle onto your own Stripe

## Decision points I need to flag before building

**Stripe account.** Your workspace already has `Stripe (live)` and `Stripe (sandbox)`
connections (from your other project). I will use the enable flow and immediately read
back the connected account ID. If it is not `acct_1QvqlvLbOwHrqvEJ` — or the flow wants
to create a new account — I stop and tell you before writing a single line of checkout
code. You will have to disconnect Paddle yourself from the Payments dashboard (three-dots
menu, top right); there is no tool that can do it for me.

**Statement descriptor.** `EEE INTL* REBUILT` requires the descriptor suffix set on the
Stripe account. I can set the suffix; the `EEE INTL` prefix comes from your account's
business profile and is already correct on that account. Verified after connect, not assumed.

**Managed payments.** Off. Only `automatic_tax` is enabled. No +3.5%.

## What gets removed

Paddle code deleted, not left dormant:
`src/lib/paddle.ts`, `src/lib/paddle.server.ts`, `src/hooks/usePaddleCheckout.ts`,
`src/utils/payments.functions.ts`, `src/routes/api/public/payments/webhook.ts`,
`PaymentTestModeBanner` (replaced by a Stripe-aware one), plus Paddle branches in
`useSubscription`, `billing.functions.ts`, `useMogulBundleCheckout`, `subscribe.tsx`,
`PricingTiers.tsx`, `course.tsx`, `onboarding.tsx`, `CancelSubscriptionSection.tsx`.
Paddle env vars and the `paddle_webhook_events` table go with them.

Nothing will route to Paddle when this is done — I will grep the whole tree for `paddle`
and show you the result as proof.

## Environment-scoped price IDs (the bug from your other project)

New table `stripe_catalog`, one row per logical product, with **separate columns**:

```text
key             test_product_id  test_price_id  live_product_id  live_price_id
pro_monthly     prod_...         price_...      prod_...         price_...
pro_annual      ...              ...            ...              ...
mogul_bundle    ...              ...            ...              ...
course_497      ...              ...            ...              ...
```

Checkout resolves the column pair by the environment of the *secret key doing the call*,
server-side. A preview test checkout physically cannot write into the live columns —
they are different columns, not different rows, so there is no "wrong row won" failure
mode and no "No such price" in live.

## Products and prices created in Stripe

Free (no Stripe object), Plus and Pro monthly + annual as recurring prices with a 30-day
trial (`trial_period_days: 30`), Mogul Bundle $99 one-time, Course $497 one-time. Amounts
carried over exactly as they are today so nothing on the pricing page changes.

## Checkout

Stripe Checkout Sessions created by a server function, with:
`automatic_tax: enabled`, `client_reference_id` = user id, customer created/reused per user,
`payment_method_types`: card, link, cashapp. Apple Pay and Google Pay ride on `card`
automatically in Checkout. No Affirm/Klarna/Afterpay. Payment logos on the pricing page will
be rendered from the list Stripe actually reports as enabled — nothing shown that is not live.

## Cancellation — taps

**Today:** Settings → Manage subscription → opens the Paddle portal in a new tab → find the
subscription → cancel → confirm. Four to five taps plus a context switch off your site.

**After:** Settings → Subscription → **Cancel**. Two taps, then one plain confirm dialog
("Cancel subscription — access continues until <date>"). No retention screen, no streak
guilt, no discount offer, no "are you sure you want to lose". It calls
`stripe.subscriptions.update(..., { cancel_at_period_end: true })` directly. That is what
California's ARL asks for.

## Pre-renewal reminder email

Cron already runs daily. New job reads subscriptions renewing in 3 days and sends a REBUILT
black/gold email stating the exact amount, the exact charge date, and a one-tap cancel link
that deep-links to Settings → Subscription. Fires for trial-end and every recurring renewal,
deduped so nobody gets it twice.

## Webhook

One `/api/public/hooks/stripe` handler (the existing one, extended) with signature
verification and an idempotency table. Events: `checkout.session.completed`,
`customer.subscription.created|updated|deleted`, `invoice.payment_failed`. It calls the same
`grant_tier()` your app already uses, so entitlements behave identically to today.

## The 42 existing accounts

They are untouched. Accounts, profiles, streaks, food logs, plans and guides all live in your
own database, not in Paddle — Paddle only ever held payment objects, and there are zero
transactions and zero subscribers. Nobody loses data, nobody loses tier: everyone is on free
or a manually granted tier, and grants live in your database too. After the switch they see
identical app behavior; the only difference is the checkout they meet when they upgrade.

## Legal entity

`Phantom Era LLC` replaced with **EEE International LLC, 888 Prospect St Suite 200,
La Jolla, CA 92037** on `/privacy`, `/terms`, `/refunds`, and the name added to `/legal`
which currently has none. Terms updated to say charges are processed by Stripe and appear
as `EEE INTL* REBUILT`.

## Order of work

1. You disconnect Paddle in the Payments dashboard.
2. Connect Stripe, verify the account ID and descriptor, report back to you.
3. Catalog table + products/prices.
4. Checkout, webhook, subscription hook, two-tap cancel.
5. Renewal reminder email.
6. Legal text.
7. Grep proof that Paddle is gone, then publish on your say-so.
