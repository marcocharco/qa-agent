import type { Coverage, HistoryRow, Live, RequirementRow, TrailRow } from "@/lib/queries";

export type Data = {
  trailId: string;
  trail: { title: string; description: string; branch: string; state: "open" | "merged" };
  trails: TrailRow[];
  fresh: RequirementRow[];
  regression: RequirementRow[];
  coverage: Coverage;
  live: Live;
  history: HistoryRow[];
};
