import type { AdProvider } from "../types";

function makeTrackingUrl(baseUrl: string, placementKey: string, eventType: "impression" | "click") {
  const url = new URL(baseUrl);
  url.searchParams.set("providerKey", "rtbhouse");
  url.searchParams.set("placementKey", placementKey);
  url.searchParams.set("eventType", eventType);
  return url.toString();
}

export const rtbHouseProvider: AdProvider = {
  key: "rtbhouse",
  buildRenderConfig({ placement, eventBaseUrl, householdSegments }) {
    return {
      placement,
      providerKey: "rtbhouse",
      accountKey: placement.accountKey,
      campaignKey: placement.campaignKey,
      targetUrl: placement.targetUrl,
      tracking: {
        impressionUrl: makeTrackingUrl(eventBaseUrl, placement.placementKey, "impression"),
        clickUrl: makeTrackingUrl(eventBaseUrl, placement.placementKey, "click"),
      },
      // RTB House custom tags/segments should stay anonymized.
      metadata: {
        ...(placement.metadata as Record<string, unknown> | undefined),
        customSegments: householdSegments,
      },
    };
  },
};
