# Answer key (for the team, not for the sessions)

Prompt numbers are `session/prompt`, e.g. 02/05 is prompt [5] of `sessions/02-annual-volume.md`.
Files are in the demo repo. The final buggy code is in `reference/after-02-buggy`, the fixed code in `reference/after-03-fixed`.

## Bug A, the regression: SAVE10 does nothing for Team on Annual
- Requirement it violates: 02/03 ("SAVE10 has to work on both plans in both billing modes", with the Team 3 seats annual numbers: subtotal $835.20, discount -$83.52, total $751.68). Earlier support: 01/05 ("it applies to both cards"). It worked for Team monthly after session 1, and for Team annual right after 02/03 (one `quote()` function).
- Introduced by: 02/05, "split quote() into monthlyQuote and annualQuote ... plans with a volume tier get the volume discount and return, plans without one get the coupon and return".
- Code change: `lib/pricing.ts` gets `annualQuote()` with `if (plan.volume) { ... return { ..., couponCents: 0, ... } }` before the coupon line. Team has a volume tier, so it returns early and never reaches the coupon. Pro (no tier) still gets the coupon.

## Bug B, the boundary: volume discount starts at 11 seats
- Requirement it violates: 02/02 ("5% off the subtotal at 10 or more seats", Team 10 seats monthly: subtotal $290.00, discount -$14.50, total $275.50; 9 seats gets none). The seed UI also says "5% off at 10 or more seats".
- Introduced by: 02/07, "the discount applies once they're over 10 seats" together with `volume: { over: 10, rate: 0.05 }`.
- Code change: a shared helper `volumeDiscount()` using `seats > plan.volume.over` instead of `>=`. It worked correctly (`>= atSeats`) until this prompt.

## Bug C, display versus state: Team minus below 3
- Requirement it violates: 01/03 ("3 seats minimum ... the minus button has to stop at 3 ... pressing minus there should do nothing").
- Introduced by: 02/06, "minus is just Math.max(1, seats - 1) ... the seat number we show is clamped to the plan's min ... the total reads straight off the seats state".
- Code change in `components/PlanCard.tsx`: the decrement floors at 1 instead of `plan.minSeats`, and the shown number becomes `Math.max(plan.minSeats, seats)`. Press minus twice on Team: it still shows 3 but prices 1 seat, $29.00. It worked until this prompt.

## Bug D, wrong base: annual coupon taken off the pre-annual price
- Requirement it violates: 02/03 ("annual first, then volume discount, then SAVE10", Pro 5 seats annual with SAVE10: -$91.20, total $820.80). Annual-first ordering was correct after 02/03 and 02/05.
- Introduced by: 02/08, "pull it into one couponFor(listCents) helper ... in annualQuote feed it the list price total, seats times the plain monthly price times 12 ... then take the result off the annual total". It reads as a refactor to share one helper, not as a requirement change.
- Code change: in the non-volume branch of `annualQuote()` the coupon is `Math.round(plan.cents * seats * 12 * couponRate)` instead of a rate applied to the discounted annual amount. Pro 5 seats annual: -$114.00, total $798.00.

## Untestable ask
- 02/04 ("the pricing page should feel more trustworthy"). It is phrased as ideas only, so a faithful agent changes no code. Receipts should list it as not testable.

## Notes
- A and D both live in `annualQuote()`. A comes from 02/05, D from 02/08. The A requirement is still stated for annual in 02/03, which is what Receipts should cite.
- Session 3 prompt 1 pastes the report with the four "Likely cause" lines. 03/03 merges the two quote functions back into one.
