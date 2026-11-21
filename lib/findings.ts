export type CheckResult = {
  requirementId: string;
  requirementText: string;
  passed: boolean;
  failedStep: number | null;
  reason: string;
};

/** requirementId -> id of its open Entire finding */
export type OpenFindings = Record<string, string>;

export type FindingAction =
  | { kind: "create"; requirementId: string; title: string; body: string }
  | { kind: "resolve"; requirementId: string; findingId: string; message: string };

/** One finding per failing requirement. A later pass resolves it. No duplicates. */
export function decideFindings(open: OpenFindings, results: CheckResult[]): FindingAction[] {
  const actions: FindingAction[] = [];
  for (const r of results) {
    const existing = open[r.requirementId];
    if (!r.passed && !existing) {
      actions.push({
        kind: "create",
        requirementId: r.requirementId,
        title: r.requirementText,
        body: `Failed at step ${r.failedStep}: ${r.reason}`,
      });
    } else if (r.passed && existing) {
      actions.push({
        kind: "resolve",
        requirementId: r.requirementId,
        findingId: existing,
        message: `Passed on re-run: ${r.reason}`,
      });
    }
  }
  return actions;
}

export type OverrideKind = "not-a-bug" | "requirement-wrong";

export type OverrideOutcome = {
  resolve: { findingId: string; message: string };
  /** null leaves the requirement as it is */
  requirementStatus: "rejected" | null;
  removeFromBrain: boolean;
};

/** A reviewer clears a failure. Resolving the finding unblocks the merge. */
export function overrideFinding(
  kind: OverrideKind,
  target: { requirementId: string; findingId: string },
): OverrideOutcome {
  if (kind === "requirement-wrong") {
    return {
      resolve: { findingId: target.findingId, message: "Overridden by reviewer: the requirement is wrong" },
      requirementStatus: "rejected",
      removeFromBrain: true,
    };
  }
  return {
    resolve: { findingId: target.findingId, message: "Overridden by reviewer: not a bug in this run" },
    requirementStatus: null,
    removeFromBrain: false,
  };
}
