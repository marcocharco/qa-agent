# Handoff: demo session

You are continuing the **demo build** for Receipts. Read `SPEC.md` (Status, "Demo repo and scripted sessions", "Demo script"), `demo/README.md` and `demo/ANSWER_KEY.md` first. Work from the worktree `/Users/marco/Developer/hw13-demo` (branch `demo-kit`).

## Three sessions, three owners
- **Product session** (Rex tab `product-session`): `/Users/marco/Developer/hw13`, branch `main`. Orchestrator, reports, Entire integrations, eval. Do not edit its tree.
- **Dashboard session** (Rex tab `dashboard-ui`): `/Users/marco/Developer/hw13-ui`, branch `dashboard`, localhost port 3100. The UI only.
- **Demo session (you):** `demo/` via the `hw13-demo` worktree, and the separate repo `marcocharco/acme-pricing-demo` at `/Users/marco/Developer/acme-pricing-demo`.
- Ports: 3000 product, 3100 dashboard, 3200 and up for demo checks. Use `next start`, not `next dev`, in the demo repo (`next dev` rewrites `AGENTS.md` and dirties the tree, which breaks the driver's clean-tree check).

## What the demo is
A scripted but real chat history. Headless Claude Code sessions, fed developer prompts, build an ACME pricing page in `acme-pricing-demo`. Each session becomes an Entire Trail that Receipts later reads, tests on a live site, and traces failures back to the prompt. The sessions are scripted by us, and the Devpost write-up must say so.

## State right now (Nov 21, evening)
- **Seed** (static ACME UI) pushed to `main`. **Session 1** ran, merged as **Trail #3** (PR #1, merge commit `fc02bad`). Entire linked its session to the Trail on its own. Trail #3 shows `status: open, phase: complete`, which is how a merged Trail looks.
- **Session 2 (the demo Trail) is DONE and verified.** Branch `feat/annual-volume` in the demo repo, commit `e68494c` ("session 02-annual-volume"), clean tree, not pushed. Chrome check against the buggy values passes for all four bugs: A Team annual with SAVE10 gives $835.20 and no discount line, B Team at 10 seats gives $290.00 with no volume line, C minus pressed twice on Team shows 3 and prices $29.00, D Pro 5 seats annual with SAVE10 gives -$114.00 and $798.00. Log: `/private/tmp/claude-501/-Users-marco-Developer-hw13/92c2823b-6e84-4674-9412-7f75209063cc/scratchpad/session02b.log`. Its Entire checkpoint exists locally and has NOT been scanned or pushed yet.
- A first attempt at session 2 with the original prompts produced fully correct code and no bugs. It was discarded (never pushed, checkpoint deleted).
- Nothing in the demo repo beyond Trail #3 has been pushed (session 2 is local only). No demo Trail (#4) exists yet. No Vercel project exists for the demo repo.

## Next steps, in order
1. **Session 2 verification is done (see State). Only redo it if you change anything.** In the demo repo: `npm run build && npx next start -p 3200`, then `cd /Users/marco/Developer/hw13-demo/demo/verify && node check.mjs http://localhost:3200 --expect buggy`. All checks should match the buggy build. A prints "none" for the coupon line (a "-$0.00" line is treated the same). Read the agent's replies in the log for any deviation it announced.
   - If a bug missed: reword the prompt that should introduce it in `demo/sessions/02-annual-volume.md`, test the wording first in a scratch clone (see "Scratch testing"), then redo the real run. The recipe that works is in `ANSWER_KEY.md`, "What actually plants the bugs".
2. **START HERE: scan the checkpoint before anything is pushed.** The demo repo uploads checkpoints automatically on push. Dump each unpushed checkpoint (`entire checkpoint explain <id> --full`) and search for the personal email (`chenmarco16`), the key values in `/Users/marco/Developer/hw13/.env.local`, and leaked tooling words (`ponytail`, `rex`). Zero hits last time. Redaction (`.entire/settings.local.json`, email on) is already set in the demo repo, the main repo and both worktrees.
3. **Open the demo Trail, leave it open.** From the demo repo on `feat/annual-volume`: `entire trail create --title "Annual billing and volume pricing" --type feature --body "<intent and checks from the prompts>"`. This pushes the branch and the checkpoint. Trail numbers are project wide, so it will be #4 (or higher if others exist). Do not merge it: it must stay open for Receipts. The findings gate is on, approvals are off.
4. **Deploy the buggy branch as the "live site".** `npx vercel deploy --prod --yes --name acme-pricing-demo` from the demo repo (Vercel is already logged in as `marcocharco`). The production alias is publicly reachable, so TinyFish can use it. Run `check.mjs` against the live URL with `--expect buggy`. In the pitch this is "our staging site". Record the URL in `SPEC.md` and tell the product session (`TARGET_URL`).
5. **Run session 3 (the fix) ahead of time** on a copy branch such as `feat/annual-volume-fixed` so the buggy branch stays intact for repeated demos. Verify with `--expect correct`, redeploy that build under a second Vercel name for the "green re-run", and keep it ready for the fix beat. Prompts are in `demo/sessions/03-fix.md` (prompt 1 is a pasted Receipts bug report).
6. **Hand facts to the product session.** Update `HANDOFF.md` and `SPEC.md` with: `ENTIRE_PROJECT=gh/marcocharco`, `TARGET_REPO_DIR=/Users/marco/Developer/acme-pricing-demo`, the Trail numbers, the live URL, how to run `scripts/orchestrate.mts <trail>`. Merge `demo-kit` into `main` only when the product session is at a clean commit (`git -C /Users/marco/Developer/hw13 merge demo-kit`).
7. **Later, once the product features exist:** help rehearse the full flow, check Receipts' output against the answer key (it should cite 02/03 for bug A, 02/02 for B, 01/03 for C, 02/03 for D, and attribute to prompts 02/05, 02/08, 02/07, 02/09), the prevention beat (Brain recall), the backup video, and the Devpost write-up.

## Commands you will need
- Run a session on the existing repo (no seeding, clean tree required): `cd /Users/marco/Developer/hw13-demo/demo && SESSIONS="02-annual-volume" bash run-sessions.sh --existing --yes /Users/marco/Developer/acme-pricing-demo > <log> 2>&1`. Run it in the background and read the log. The driver disables the operator's plugins, strips Rex from `PATH`, and passes `--disable-slash-commands`, because otherwise personal plugins leak into the transcript and skew the code. `CLAUDE_MODEL=<alias>` is supported.
- Scratch testing of a prompt change (no Entire capture, no GitHub remote): `git clone --branch main /Users/marco/Developer/acme-pricing-demo <dir> && cd <dir> && git remote remove origin`, set the noreply git identity, `npm ci`, copy `demo/` to a scratch kit and edit the prompt file there, run the driver with `--existing`, then verify. Existing scratch material: `.../scratchpad/kit-b` (explicit prompts), `exp-explicit`, `exp-c`, `exp-haiku`.
- Entire: `entire trail list --project gh/marcocharco --repo gh/marcocharco/acme-pricing-demo --json`, `entire trail sessions <n> --json`, `entire trail merge --dry-run`, `entire checkpoint list [--outgoing]`.
- Identity: git author is `Marco Chen <61860244+marcocharco@users.noreply.github.com>` everywhere. Never put the personal email in chat, files or commits.

## Facts that cost time
- **A careful agent will not plant a hidden bug from a contradictory prompt.** It resolves the contradiction toward the earlier requirement and says so (`over: 9` instead of `over: 10`, a floor of 3 instead of 1). The model `haiku` did the same. Explicit developer decisions with a reason work: the coupon kept off the volume path until finance signs off (A), a strict `>` with "don't change the 10" (B), the raw seat state fed to the quote (C), the coupon taken from the list price total "the same way in both paths" (D). All four were verified in a scratch clone.
- **Verifier pitfalls:** Playwright's `isEnabled()` and `click()` treat `aria-disabled` buttons as disabled. `verify/check.mjs` skips only natively disabled buttons and forces the click.
- **Session 1 produced its own structure** (`calculateQuote`, `PricingCard`, `PricingTable`, `PlanCard`). The hand built `demo/reference/` folders do not match it and are an outdated fallback.
- **Checkpoint deletion on a public remote is blocked** by the auto mode classifier. Eight early checkpoints on `qa-agent` contain the personal email. The user decided to leave them. Local only deletes (`--local-only --force`) work.
- **Checkpoint push policy:** the main repo is `manual` (nothing uploads on `git push`). The demo repo is `automatic` on purpose, because Trails need the sessions on the remote.
- **Rex tabs:** a slash skill passed as an argument to `claude` in a new tab does not run, only one typed at the prompt does. New tab command: `rex window new -s "$REX_SESSION" <name> -c <dir> --focus=false -- sh -c 'claude "$(cat <promptfile>)"'`.
- **Gemini** key was on the free tier (20 requests a day per model). Keep any live Gemini use minimal. This does not affect the demo repo work.
- Never use the em dash in anything written.

## Pending decisions for the user
- Whether the fix session should run ahead of time on a copy branch (recommended) or only at demo time.
- When to merge `demo-kit` into `main`.
- Whether to keep the Vercel projects `receipts-demo-buggy` and `receipts-demo-control` (old design, owned by the product side) or retire them in favor of the demo repo's deployments.
