# Entire proof

Generated 2026-11-22T07:52:24.889Z by `scripts/entire-proof.mts`. Everything below is read live from the Entire CLI in the demo repo (`/Users/marco/Developer/acme-pricing-demo`), then checked against what ArcherFish stored. Re-run any command yourself in that folder.

## 1. Entire is installed and wired to the repo

```
$ entire version
Entire CLI 0.13.4
Go version: go1.27.4
OS/Arch: darwin/arm64
$ entire trail list --project gh/marcocharco --json  (summary)
```

| Trail | Title | Status |
|---|---|---|
| #4 | Annual billing and volume pricing | open |
| #3 | Base pricing: per-card seats, Team minimum, SAVE10 coupon | open |

## 2. The Trail's agent sessions come from Entire

```
$ entire trail sessions 4 --project gh/marcocharco --json
```

Trail #4 has 1 linked session(s): `592c31ad-d010-4ba7-8b75-5add236ef78f`.

## 3. Citation check: every quoted requirement is verbatim in the session transcript fetched from Entire

**11 of 11** quotes found in the real transcript. Negative control (one character changed in a quote): rejected, as it should be.

| Verbatim in transcript | Quote | Source |
|---|---|---|
| yes | the "Price per seat" line should keep showing the per seat price | session `fcd63cb4`, message `532b15f3` |
| yes | it's $19.00 per seat per month, 1 to 50 seats | session `fcd63cb4`, message `2439e791` |
| yes | each card gets its own seat stepper and its own total, so + and - on p | session `fcd63cb4`, message `2439e791` |
| yes | $29.00 per seat per month, 3 seats minimum so it starts at 3 and the m | session `fcd63cb4`, message `532b15f3` |
| yes | no discount line at all when there's no coupon | session `fcd63cb4`, message `afe5d57f` |
| yes | the pricing page should feel more trustworthy. no idea what exactly, j | session `592c31ad`, message `0591dc90` |
| yes | it applies to both cards. | session `fcd63cb4`, message `9a6ae274` |
| yes | on Apply show "SAVE10 applied: 10% off" under the box, anything else s | session `fcd63cb4`, message `9a6ae274` |
| yes | under each total i want a "Subtotal: $95.00" line, and when a coupon i | session `fcd63cb4`, message `afe5d57f` |
| yes | the box takes SAVE10, case doesn't matter and strip any spaces, it's 1 | session `fcd63cb4`, message `9a6ae274` |
| yes | total is subtotal minus discount, rounded to the cent. | session `fcd63cb4`, message `afe5d57f` |

## 4. Attribution: `entire why` maps a line of code to the checkpoint, session and exact prompt that wrote it

| Line | Where | Checkpoint | Session | Prompt it came from | Matches the answer key |
|---|---|---|---|---|---|
| Bug A: Team skips the coupon on annual | `lib/pricing.ts:97` | `01M8063PQ1` | `592c31ad` | pricing.ts is getting hard to follow with all the annual and | yes, prompt 02/05 |
| Bug B: strict > at the volume tier | `lib/pricing.ts:61` | `01M8063PQ1` | `592c31ad` | can you pull the magic numbers in pricing.ts into named cons | yes, prompt 02/08 |
| Bug C: minus floors at 1, not the plan minimum | `components/PricingCard.tsx:49` | `01M8063PQ1` | `592c31ad` | clampSeats gets applied in the setters and again inside calc | yes, prompt 02/07 |
| Bug D: coupon taken from the list price | `lib/pricing.ts:103` | `01M8063PQ1` | `592c31ad` | the coupon math is now written twice, once in monthlyQuote a | yes, prompt 02/09 |
| Control: a line from session 1 | `lib/pricing.ts:14` | `01M803YVPT` | `fcd63cb4` | ok let's make the cards live. each card gets its own seat st | different session, as expected |
| Control: a line committed by hand, not by an agent | `app/globals.css:40` | none | none | (none) | no checkpoint (not agent written), as expected |

**Attribution accuracy: 4 of 4** planted bugs traced to the prompt that introduced them. The controls resolve to a different session, or to nothing, so the lookup is not pinned to one answer. Reproduce: `entire why lib/pricing.ts:<line>` on branch `feat/annual-volume`.

## 5. Graph: ranked code context instead of whole files

```
$ entire graph query --format agent --head --profile full "<failure in plain words>"
```

Changed source files: 3685 tokens (about, characters / 4). Graph query context: 1734 tokens. That is 53 percent less code for the model to read.

## 6. Brain: approved requirements are memories, anchored to the code they constrain, shown to an agent about to edit it

ArcherFish writes a memory when a requirement is approved. It asks Entire Graph which file implements the requirement and names that file in the memory, so Brain's edit hook can show it to any Claude Code session that is about to edit that file.

```
$ entire brain hook pre-edit --file lib/pricing.ts   # what an agent sees before editing the file
```

```
[invariant] lib/pricing.ts, components/PricingCard.tsx: Annual comes first, then the coupon: Pro at 5 seats annual with SAVE10 has discount -$91.20 and total $820.80 per year.
[invariant] lib/pricing.ts, components/PricingCard.tsx: SAVE10 works on Team in annual mode: Team at 3 seats annual with SAVE10 has subtotal $835.20, discount -$83.52, total $751.68 per year.
[invariant] lib/pricing.ts, components/PricingCard.tsx: Pro at 5 seats monthly totals $95.00 per month.
[invariant] lib/pricing.ts, components/PlanCard.tsx: Team needs at least 3 seats: pressing minus at 3 seats keeps the count at 3 and the total at $87.00 per month.
[invariant] lib/pricing.ts, components/PricingCard.tsx: SAVE10 takes 10% off the Team plan on monthly billing.
[invariant] lib/pricing.ts, components/PricingCard.tsx: Pro at 5 seats on annual billing totals $912.00 per year, with the line Billed $912.00 yearly.
[invariant] lib/pricing.ts, components/PricingCard.tsx: Team at 9 seats monthly gets no volume discount and totals $261.00 per month.
[invariant] lib/pricing.ts, components/PricingCard.tsx: Team gets 5% off the subtotal at 10 or more seats: Team at 10 seats monthly has subtotal $290.00, volume discount -$14.50, total $275.50 per month.
```

```
$ entire brain recall "change the volume discount threshold"
```

```
fact:49cc5c9436d43de2d9a42efd invariant [project.requirements.convention]
  lib/pricing.ts, components/PricingCard.tsx: Team at 9 seats monthly gets no volume discount and totals $261.00 per month.
fact:a86041bb48028e2fe2887602 invariant [project.requirements.convention]
  lib/pricing.ts, components/PricingCard.tsx: Team gets 5% off the subtotal at 10 or more seats: Team at 10 seats monthly has subtotal $290.00, volume discount -$14.50, total $275.50 per month.
fact:ddd732d633c89c428fb5d0b8 invariant [project.requirements.convention]
  lib/pricing.ts, components/PricingCard.tsx: Annual comes first, then the coupon: Pro at 5 seats annual with SAVE10 has discount -$91.20 and total $820.80 per year.
fact:837b3dedb1212b78e60dd6f5 invariant [project.requirements.convention]
  lib/pricing.ts, components/PricingCard.tsx: SAVE10 works on Team in annual mode: Team at 3 seats annual with SAVE10 has subtotal $835.20, discount -$83.52, total $751.68 per year.
```

## 7. Findings and the merge gate live in Entire

```
$ entire trail finding list 4 --project gh/marcocharco
```

```
No findings found.
```

```
$ entire trail merge 4 --dry-run
Change acme-pricing-demo/2 of trail #4 (feat/annual-volume → main)
  Mergeable: yes
  Head:      07874b61
  Conflicts: clean
  Gates:
    - approvals   skipped  No reviewers have approved this trail
    - checks      skipped
    ✓ findings    passed   No blocking findings
    - up_to_date  skipped  Up to date
  Checks:    1 passed · 0 running · 0 failed (1 total)
Change acme-pricing-demo/2 of trail #4 is mergeable (dry run; no merge performed).
```

