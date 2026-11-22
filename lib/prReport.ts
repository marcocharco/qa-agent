import { collapseSteps } from "./collapse";
import { graphDiff, type FileChange } from "./graph";
import { buildCards, shortLabel, splitReason, verdictOf, summarize, type IconState, type Verdict } from "./overview";
import { getCheck, getLive, getTrail, listRequirements, trailCoverage } from "./queries";

export type ProofItem = { checkId: string | null; state: IconState; label: string; text: string; claim: string; saw: string | null; frame: string | null };
export type ReportDoc = {
  trailId: string; title: string; description: string; branch: string; commit: string | null; ranAt: string | null;
  verdict: Verdict; passed: number; ran: number;
  asks: { label: string; text: string; quote: string | null }[];
  changes: FileChange[];
  proof: ProofItem[];
  decisions: { was: string; now: string }[];
  untestable: { text: string; reason: string }[];
};

const rank: Record<IconState, number> = { failed: 0, review: 1, errored: 2, running: 3, passed: 4, proposed: 5, todo: 6 };

/** Everything a reviewer needs in place of a hand-written PR description: why, what changed, and proof. */
export async function buildReport(trailId: string): Promise<ReportDoc | null> {
  const trail = await getTrail(trailId);
  if (!trail) return null;
  const [{ fresh, regression }, live, coverage] = await Promise.all([listRequirements(trailId), getLive(trailId), trailCoverage(trailId)]);
  const cards = buildCards(fresh, regression, live);
  const s = summarize(cards);

  // The last screenshot of each check's own steps: what the page looked like when the verdict was reached.
  const proof: ProofItem[] = await Promise.all(cards.filter((c) => c.check).map(async (c) => {
    const detail = await getCheck(c.check!.id);
    const r = detail?.replay;
    const { claim, saw } = splitReason(c.check!.reason);
    return { checkId: c.check!.id, state: c.state, label: shortLabel(c.req.text, 70), text: c.req.text, claim, saw, frame: r ? (collapseSteps(r.steps.slice(r.start, r.end + 1), r.cursors).at(-1)?.file ?? null) : null };
  }));
  proof.sort((a, b) => rank[a.state] - rank[b.state]);

  const asks = fresh.filter((r) => r.testable && r.status !== "rejected" && r.status !== "superseded" && !r.supersedes)
    .map((r) => ({ label: shortLabel(r.text, 70), text: r.text, quote: r.quote }));
  const base = "main";
  return {
    trailId, title: trail.title, description: trail.description, branch: trail.branch, commit: live.run?.headSha ?? trail.last_head_sha, ranAt: live.run?.startedAt ?? null,
    verdict: verdictOf(cards, live), passed: s.passed, ran: s.ran, asks,
    changes: trail.branch && process.env.TARGET_REPO_DIR && !trailId.startsWith("sample-") ? await graphDiff(process.env.TARGET_REPO_DIR, base, trail.branch) : [],
    proof,
    decisions: fresh.filter((r) => r.supersedes && r.status === "proposed").map((r) => ({ was: r.supersedes!.text, now: r.text })),
    untestable: coverage.untestable,
  };
}

const mark: Record<IconState, string> = { passed: "✅", failed: "❌", review: "🚩", errored: "⚠️", running: "⏳", proposed: "◻️", todo: "◻️" };
const headline: Record<Verdict, string> = {
  merge: "✅ All requirements pass on the live site", hold: "❌ Failing requirements block this merge", review: "🚩 Needs a look before merging",
  running: "⏳ Run in progress", idle: "◻️ Not run yet", broken: "⚠️ The last run could not test anything",
};

/** The report as Markdown for a PR description. Proof links point at the hosted report, where the replays live. */
export function prMarkdown(d: ReportDoc, baseUrl: string): string {
  const out: string[] = [`## ${d.title}`, "", `**${headline[d.verdict]}** (${d.passed} of ${d.ran} tested requirements pass)`, ""];
  out.push("### Why", "");
  if (d.description) out.push(d.description.trim(), "");
  for (const a of d.asks) out.push(`- ${a.text}${a.quote ? `\n  > "${a.quote}"` : ""}`);
  if (d.changes.length) {
    out.push("", "### What changed", "");
    for (const f of d.changes) { out.push(`- \`${f.path}\` (${f.status})`); for (const i of f.items.slice(0, 6)) out.push(`  - ${i}`); }
  }
  if (d.proof.length) {
    out.push("", "### Proof", "");
    for (const p of d.proof) {
      out.push(`- ${mark[p.state]} ${p.label}`);
      if (p.state !== "passed" && p.claim) out.push(`  - ${p.claim}${p.saw ? ` Saw: ${p.saw}` : ""}`);
      if (p.checkId && p.state === "failed") out.push(`  - [Replay](${baseUrl}/t/${d.trailId}/checks/${p.checkId})`);
    }
  }
  if (d.decisions.length) {
    out.push("", "### Decisions to confirm", "");
    for (const x of d.decisions) out.push(`- Was: ${x.was}`, `  Now: ${x.now}`);
  }
  out.push("", `[Full report with replays](${baseUrl}/r/${d.trailId})`);
  return out.join("\n");
}
