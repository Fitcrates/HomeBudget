import type { Doc } from "../../../_generated/dataModel";
import type { SpendingProfile } from "../../types";

export type ScoringInput = {
  offer: Doc<"offers">;
  source: Doc<"offer_sources">;
  profile: SpendingProfile;
  segments: Array<{ segmentKey: string; score: number }>;
  matchedSegments: string[];
  matchedCategoryKeys: string[];
  now: number;
};

export type ScoringResult = {
  score: number;
  factors: Array<{ key: string; value: number; weight: number }>;
};

export type ScoringStrategy = {
  key: string;
  score(input: ScoringInput): ScoringResult;
};
