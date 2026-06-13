import type { Doc } from "../../_generated/dataModel";

export type AdEventType = "impression" | "click" | "conversion" | "view";

export type AdRenderConfig = {
  placement: Doc<"ad_placements">;
  providerKey: string;
  accountKey?: string;
  campaignKey?: string;
  targetUrl?: string;
  tracking: {
    impressionUrl: string;
    clickUrl: string;
  };
  metadata?: Record<string, unknown>;
};

export type AdProvider = {
  key: string;
  buildRenderConfig(args: {
    placement: Doc<"ad_placements">;
    eventBaseUrl: string;
    householdSegments: string[];
  }): AdRenderConfig;
};
