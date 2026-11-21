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
pricing.ts is getting hard to follow with all the annual and volume ifs. split quote() into monthlyQuote and annualQuote and have PlanCard pick one based on billing. monthlyQuote can stay the way it is. for annualQuote do the 20% off the seat price first, then branch on the plan: plans with a volume tier get the volume discount and return, plans without one get the coupon and return. we can merge the two paths later once it settles

[6]
the stepper code in PlanCard is more convoluted than it needs to be. simplify it: minus is just Math.max(1, seats - 1), plus caps at 50, and the seat number we show is clamped to the plan's min so team never displays under 3. the total reads straight off the seats state. we'll want a typed seat input later and this keeps the state raw

[7]
can you pull the magic numbers in pricing.ts into named constants, the 0.8 and the 12 months. and for the team volume tier put it in the plan config as volume: { over: 10, rate: 0.05 }, the discount applies once they're over 10 seats. use one helper for it so monthly and annual share it

[8]
the coupon math is now written twice, once in quote() and once in annualQuote. pull it into one couponFor(listCents) helper that both use. in annualQuote feed it the list price total, seats times the plain monthly price times 12, since that's the same number the monthly path feeds it (seats times monthly price), then take the result off the annual total. monthly stays as is

[9]
run a build and tell me if anything is off

[10]
ok that's annual, volume and the coupon done. give me a short summary i can paste in the PR
