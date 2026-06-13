import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";

export const processDirtySegmentJobs = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const jobs = await ctx.runQuery(internal.offers.segments.jobs.loadDirtyHouseholds, {
      now,
      limit: args.limit ?? 100,
    });

    let processed = 0;
    for (const job of jobs) {
      await ctx.runMutation(internal.offers.segments.jobs.recalculateHousehold, {
        householdId: job.householdId,
      });
      processed += 1;
    }

    return { processed };
  },
});
