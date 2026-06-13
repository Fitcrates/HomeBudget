import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "recalculate dirty offer segments",
  { minutes: 15 },
  internal.offers.segments.scheduler.processDirtySegmentJobs,
  { limit: 100 }
);

crons.daily(
  "expire inactive offers",
  { hourUTC: 2, minuteUTC: 30 },
  internal.offers.catalog.lifecycle.expireOffers
);

crons.daily(
  "ingest active offer providers",
  { hourUTC: 3, minuteUTC: 0 },
  internal.offers.providers.ingestionScheduler.ingestAllActiveProviders
);

export default crons;
