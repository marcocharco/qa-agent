# Answer key (for the team, not for the sessions)

Prompt numbers are `session/prompt`, e.g. 02/05 is prompt [5] of `sessions/02-annual-volume.md`.

Names below are the ones the real session 1 produced in `acme-pricing-demo`: `calculateQuote` and `clampSeats` in `lib/pricing.ts`, `PricingTable` (owns the coupon), `PricingCard` (owns one card's seats), `PlanCard` (presentational). The hand built `reference/` folders were written against a different structure, so treat them as an outdated fallback only.

## Bug A, the regression: SAVE10 does nothing for Team on Annual
- Requirement it violates: 02/03 ("SAVE10 has to work on both plans in both billing modes", Team 3 seats annual: subtotal $835.20, discount -$83.52, total $751.68). Earlier support: 01/05 ("it applies to both cards"). It worked for Team monthly after session 1, and for Team annual right after 02/03.
- Introduced by: 02/05, "split calculateQuote into monthlyQuote and annualQuote ... plans with a volume tier get the volume discount and return, plans without one get the coupon and return".
- Code change: `annualQuote()` has `if (plan.volume) { ... return { ..., couponDiscountCents: 0, ... } }` before the coupon line. Team has a volume tier, so it returns early and never reaches the coupon. Pro still gets the coupon.

## Bug B, the boundary: volume discount starts at 11 seats
- Requirement it violates: 02/02 ("5% off the subtotal at 10 or more seats", Team 10 seats monthly: subtotal $290.00, discount -$14.50, total $275.50; 9 seats gets none).
- Introduced by: 02/08, "the discount applies once they're over 10 seats" with `volume: { over: 10, rate: 0.05 }`.
- Code change: one shared helper using `seats > volume.over` instead of `>=`. It was correct before this prompt.

## Bug C, display versus state: Team minus below 3
- Requirement it violates: 01/03 ("3 seats minimum ... the minus button has to stop at 3 ... pressing minus there should do nothing").
- Two steps. 02/06 makes the stepper buttons always clickable (benign UI polish, the buttons used to be `disabled` at the limit). 02/07 is the one that introduces the bug: "keep the seat state raw in PricingCard ... decrease is Math.max(1, s - 1) ... calculateQuote just prices the seats it's given, and we only clamp up to the plan's min where we show the number".
- Code change: `PricingCard` decrease floors at 1, `calculateQuote` stops clamping, and only the displayed number is clamped. Press minus twice on Team at 3: it still shows 3 but prices 1 seat, $29.00.

## Bug D, wrong base: annual coupon taken off the pre-annual price
- Requirement it violates: 02/03 ("annual first, then volume discount, then SAVE10", Pro 5 seats annual with SAVE10: -$91.20, total $820.80).
- Introduced by: 02/09, "pull it into one couponFor(listCents) helper ... in annualQuote feed it the list price total, seats times the plain monthly price times 12 ... then take the result off the annual total". It reads as a refactor to share one helper, not as a requirement change.
- Code change: in the non-volume branch of `annualQuote()` the coupon is computed from `unitPrice * seats * 12`, not from the discounted annual amount. Pro 5 seats annual: -$114.00, total $798.00.

## Untestable ask
- 02/04 ("the pricing page should feel more trustworthy"). Phrased as ideas only, so a faithful agent changes no code. AnchorFish should list it as not testable.

## Notes
- A and D both live in `annualQuote()`. A comes from 02/05, D from 02/09. The A requirement is still stated for annual in 02/03, which is what AnchorFish should cite.
- Session 3 prompt 1 pastes the report with the four "Likely cause" lines. 03/03 merges the two quote functions back into one.
- Real agents drift. After each session check the code and run `verify/check.mjs` (`--expect buggy` after session 2, `--expect correct` after session 3). If a bug did not land, reword the prompt that should have introduced it, not the requirement.

## What actually plants the bugs (learned Nov 21)
A vigilant agent resolves a contradiction between a later prompt and an earlier requirement in favor of the earlier requirement, and says so. Both the default model and `haiku` produced a fully correct session 2 from the first set of prompts. What works is the developer stating the decision explicitly, with a reason, so following it is correct behavior: keep the coupon off the volume path until finance signs off (A), strict `>` and "don't change the 10" (B), raw seat state "not the plan's min" and "don't feed the clamped number to the quote" (C), coupon computed from the list price total "same way in both paths" (D). Verified in a scratch clone: all four land.

