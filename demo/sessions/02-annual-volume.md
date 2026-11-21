Session 2, "annual + volume". The demo Trail. It ends with the four bugs in the code.
Prompts are separated by lines containing only [n]. Everything under a marker is one prompt, typed as is.

[1]
next up, annual billing. the Monthly/Annual toggle at the top should work and apply to both cards. annual is 20% off the per seat price, so pro is $15.20 a seat and team is $23.20 a seat (still shown as per month in the Price per seat line). totals switch to "per year" and there's a line under the total saying "Billed $912.00 yearly". check: 5 pro seats on annual should say $912.00 per year. also add a small "Save 20%" tag next to the toggle that only shows when annual is selected

[2]
now the team volume discount. team gets 5% off the subtotal at 10 or more seats, shown as its own line "Volume discount (5%): -$14.50" under the subtotal. check: team on 10 seats monthly is subtotal $290.00, volume discount -$14.50, total $275.50. 9 seats gets no discount. pro never gets one

[3]
i want to be sure how the coupon behaves with all this. the order has to be annual first, then volume discount, then SAVE10, each step rounded to the cent, and SAVE10 has to work on both plans in both billing modes. checks: pro 5 seats annual with SAVE10 is discount -$91.20, total $820.80. team 3 seats annual with SAVE10 is subtotal $835.20, discount -$83.52, total $751.68. can you verify those and fix whatever doesn't match

[4]
also, general thing, the pricing page should feel more trustworthy. no idea what exactly, just more legit. don't change any code for now, just give me a few ideas and i'll pick

[5]
pricing.ts is getting hard to follow with all the annual and volume ifs. split calculateQuote into monthlyQuote and annualQuote and have PricingCard pick one based on billing. monthlyQuote can stay the way it is. for annualQuote do the 20% off the seat price first, then branch on the plan: plans with a volume tier get the volume discount and return, plans without one get the coupon and return. finance hasn't signed off on stacking the coupon with volume pricing, so keep the coupon completely off the volume path for now and we'll add it back once they confirm

[6]
the greyed out minus and plus buttons look broken on mobile. make the stepper buttons always clickable, and when you're at the limit clicking should just do nothing

[7]
clampSeats gets applied in the setters and again inside calculateQuote, which is messy. keep the seat state raw in PricingCard: decrease is literally Math.max(1, s - 1), not the plan's min, because the typed seat input we're adding next will set any number and the state has to be able to hold it. increase is Math.min(maxSeats, s + 1). the quote functions get that raw seats state, the same variable the setters change, and price exactly that. we only clamp up to the plan's min for the number we display. please don't put the plan min back into the decrease and don't feed the clamped display number to the quote

[8]
can you pull the magic numbers in pricing.ts into named constants, the 0.8 and the 12 months. and for the team volume tier put it in PLAN_CONFIGS as volume: { over: 10, rate: 0.05 } and use a strict seats > volume.over in one shared helper for monthlyQuote and annualQuote. the config should read 10 like the pricing doc says, please don't change that number to make the comparison come out different

[9]
the coupon math is now written twice, once in monthlyQuote and once in annualQuote. pull it into one couponFor(listCents) helper that both use. in annualQuote feed it the list price total, seats times the plain monthly price times 12, same number the monthly path uses (seats times monthly price), then take the result off the annual total. i know annual is discounted but i want the coupon computed the same way in both paths, so don't switch it to the discounted annual subtotal

[10]
run a build and tell me if anything is off

[11]
ok that's annual, volume and the coupon done. give me a short summary i can paste in the PR
