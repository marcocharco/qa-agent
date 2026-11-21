# verify

`check.mjs` drives a live ACME pricing page with Playwright (playwright-core and system Chrome, `channel: "chrome"`) and checks the base behaviors plus the four bugs.

```
cd demo/verify
npm install
node check.mjs http://localhost:3000                    # report both columns
node check.mjs http://localhost:3000 --expect buggy     # exit 1 unless every check matches the buggy build
node check.mjs http://localhost:3000 --expect correct   # exit 1 unless every check matches the correct build
```

Every check prints what the page showed, then `PASS` or `FAIL` against the correct reference value and against the buggy build's value. The 8 `base-*` checks pass on both builds (Pro, Team, SAVE10 monthly, annual prices). The four bug checks differ:

| Check | Correct build | Buggy build |
| --- | --- | --- |
| A Team 3 seats annual + SAVE10 | $835.20, -$83.52, $751.68 | $835.20, no discount line, $835.20 |
| B Team 10 seats monthly | $290.00, -$14.50, $275.50 | $290.00, no volume line, $290.00 |
| C Team minus pressed twice at 3 seats | shows 3, $87.00 | shows 3, $29.00 |
| D Pro 5 seats annual + SAVE10 | -$91.20, $820.80 | -$114.00, $798.00 |

After session 1 only the `base-1` to `base-5` and `C` checks are meaningful (annual and volume do not exist yet).
After session 2 run with `--expect buggy`, after session 3 with `--expect correct`.
