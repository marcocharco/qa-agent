export type RunSummary = {
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
  errored: number;
  failures: { text: string; reason: string }[];
};

export type Recommendation = { verdict: "merge" | "review" | "hold"; text: string };

/** Does the change match what the team asked for? Only confirmed failures hold a merge. */
export function recommend(s: RunSummary): Recommendation {
  const plural = (n: number) => (n === 1 ? "requirement" : "requirements");
  if (s.failed > 0) {
    const list = s.failures.slice(0, 5).map((f) => `- ${f.text}`).join("\n");
    return { verdict: "hold", text: `Hold the merge: ${s.failed} of ${s.total} ${plural(s.total)} fail on the live site, each confirmed by a second run.\n${list}` };
  }
  if (s.needsReview > 0 || s.errored > 0) {
    const parts = [s.needsReview && `${s.needsReview} flaky`, s.errored && `${s.errored} with no verdict`].filter(Boolean).join(" and ");
    return { verdict: "review", text: `Review before merging: ${s.passed} of ${s.total} pass, ${parts}. Nothing confirmed as broken.` };
  }
  return { verdict: "merge", text: `Safe to merge: all ${s.total} ${plural(s.total)} the team asked for pass on the live site.` };
}
