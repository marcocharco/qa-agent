Session 3, "fix". A later session, started after ArcherFish blocked the merge. Prompt 1 is the pasted bug report.
Prompts are separated by lines containing only [n]. Everything under a marker is one prompt, typed as is.

[1]
got this back from the QA run on the pricing page, can you fix all four

ArcherFish bug report, ACME pricing, 4 failures

1. Team annual ignores SAVE10
   Requirement: SAVE10 works on both plans in both billing modes.
   Steps: choose Annual, apply SAVE10, leave Team on 3 seats.
   Expected: Subtotal $835.20, Discount (SAVE10) -$83.52, Total $751.68 per year.
   Actual: Total $835.20 per year, no discount line.
   Likely cause: annualQuote in lib/pricing.ts, the volume plan branch returns without the coupon.

2. Team volume discount starts one seat late
   Requirement: Team gets 5% off the subtotal at 10 or more seats.
   Steps: Monthly, press + on Team until it shows 10.
   Expected: Subtotal $290.00, Volume discount (5%) -$14.50, Total $275.50 per month.
   Actual: Subtotal $290.00, no volume line, Total $290.00 per month.
   Likely cause: volumeDiscount in lib/pricing.ts compares seats > volume.over.

3. Team seat count shows 3 but the price uses a lower hidden number
   Requirement: Team needs at least 3 seats, the minus button stops at 3.
   Steps: Press minus twice on Team at 3 seats.
   Expected: Seat count 3, Total $87.00 per month.
   Actual: Seat count still shows 3, Total $29.00 per month.
   Likely cause: PricingCard decrease handler only floors at 1, the minimum is applied only to the number shown.

4. Annual coupon is taken off the pre-annual price
   Requirement: Order is annual first, then volume discount, then SAVE10.
   Steps: Annual, apply SAVE10, press + on Pro until it shows 5.
   Expected: Discount (SAVE10) -$91.20, Total $820.80 per year.
   Actual: Discount (SAVE10) -$114.00, Total $798.00 per year.
   Likely cause: annualQuote computes the coupon from the monthly list price times 12.

[2]
why did team annual skip the coupon in the first place? was it the branching in annualQuote or something else

[3]
let's merge monthlyQuote and annualQuote back into one calculateQuote function so annual, then volume, then coupon all go through a single path in that order. i don't want these two drifting apart again

[4]
and double check the stepper, the number on screen and the number we price with have to be the same thing. keep the clamp in the state update so minus on team stops at 3 and pro stops at 1

[5]
sanity check, run these through calculateQuote with a quick throwaway script (delete it after, don't commit it) and tell me what comes out. pro 5 seats monthly 95.00, with SAVE10 85.50. team 3 seats monthly 87.00. team 10 seats monthly subtotal 290.00, volume -14.50, total 275.50. pro 5 seats annual 912.00, with SAVE10 discount -91.20, total 820.80. team 3 seats annual with SAVE10 subtotal 835.20, discount -83.52, total 751.68

[6]
run the build one more time and give me a one line commit message for all of this
