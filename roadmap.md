# REBUILT roadmap

## Held (Evan owns)
- [ ] QA_PIN secret — Evan sets it himself. Do not touch.

## Onboarding + pricing fixes
- [x] Location step: sticky Continue + "Skip for now" (defaults United States)
- [x] Fix step entrance animation (fail-safe full opacity, honors prefers-reduced-motion)
- [x] Minimum age 18 + under-18 block screen
- [x] Country selector required, street address optional
- [x] Step counter: true screen index, fixed total (X of 14)
- [x] Copy: "Let Coach P decide"
- [x] /pricing FREE column: "Start free" -> /login; "Current plan" only for signed-in free users
- [x] /app/consult/apply: real application page (name, email, phone, needs, budget) -> lead email flow
- [x] /app/consult routing fixed so the apply page actually renders

## Login page fixes
- [x] Remove staging URLs + "Built by Evan Valdes" from /login footer (keep tagline)
- [x] "Try the demo": onboarding complete + seeded answers, lands on Today

## Final
- [x] Lovable badge hidden
- [ ] Green build, no console errors, PUBLISH

## Live bugs (Oct 5)
- [x] Demo lands on onboarding instead of Today
- [x] Onboarding per-step validation, height/training-days save, friendly errors w/ jump-back
- [x] Step counter skips — total = visible steps
- [x] /app/consult/apply hangs (welcome redirect)
- [x] /app/today -> redirect to Today
- [x] Privacy/terms operator = Phantom Era LLC
- [ ] Walk flows, publish, reopen secrets form (REVENUECAT_IOS_KEY, APPLE_REVIEW_PASSWORD)
