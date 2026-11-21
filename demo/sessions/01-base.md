Session 1, "base pricing". This Trail merges first and becomes the regression suite.
Prompts are separated by lines containing only [n]. Everything under a marker is one prompt, typed as is.

[1]
hey, this is the acme pricing page. right now everything on it is static, nothing is wired up. before we change anything can you walk me through how it's laid out, which files matter, and where you'd put the pricing logic

[2]
ok let's make the cards live. each card gets its own seat stepper and its own total, so + and - on pro shouldn't touch team. start with pro: it's $19.00 per seat per month, 1 to 50 seats, no discounts ever. put the math in lib/pricing.ts so the component just calls it. quick check from me, pro on 5 seats monthly should say $95.00

[3]
now team. $29.00 per seat per month, 3 seats minimum so it starts at 3 and the minus button has to stop at 3, max 50. check: team on 3 seats monthly is $87.00 and pressing minus there should do nothing. oh and the "Price per seat" line should keep showing the per seat price

[4]
question, what happens right now if someone mashes the minus button on team, or the plus button past 50? just explain, i don't want to change anything yet

[5]
coupon time. the box takes SAVE10, case doesn't matter and strip any spaces, it's 10% off. on Apply show "SAVE10 applied: 10% off" under the box, anything else shows "Invalid code". it applies to both cards. my checks: pro 5 seats with SAVE10 is $85.50, and team 3 seats with SAVE10 is $78.30

[6]
under each total i want a "Subtotal: $95.00" line, and when a coupon is on, a "Discount (SAVE10): -$9.50" line under that. total is subtotal minus discount, rounded to the cent. no discount line at all when there's no coupon

[7]
is the coupon logic in one place or did you duplicate it in both cards? if it's duplicated pull it into lib/pricing.ts

[8]
ok last thing before i merge this. run the build, fix anything that breaks, and give me a 3 line summary
