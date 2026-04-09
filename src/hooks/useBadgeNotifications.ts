import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  getEarnedBadges,
  type Badge,
  type UserStats,
} from "../lib/badges";

// ---------------------------------------------------------------------------
// LocalStorage helpers – persist which badges a user has already "seen" so we
// don't re-trigger the overlay on reload.
// ---------------------------------------------------------------------------
const STORAGE_KEY = "hb_seen_badges";

function getSeenBadgeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistSeenBadgeIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // quota exceeded – best effort
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface BadgeNotification {
  badge: Badge;
  /** Timestamp when the notification was queued (for ordering / dedup). */
  queuedAt: number;
}

export function useBadgeNotifications(householdId: Id<"households"> | null) {
  // ---- Convex subscriptions ----
  const memberStats = useQuery(
    api.analytics.householdMemberStats,
    householdId ? { householdId } : "skip"
  );
  const myProfile = useQuery(api.profile.getMyProfile);

  // ---- State ----
  const [queue, setQueue] = useState<BadgeNotification[]>([]);
  const [current, setCurrent] = useState<BadgeNotification | null>(null);

  // Tracks badge IDs the user has ever "acknowledged" (seen the animation for).
  const seenRef = useRef<Set<string>>(getSeenBadgeIds());

  // Guard against the very first render where stats land – we don't want to
  // show 10 badges if the user already had them earned before this feature
  // existed. After the first hydration we set this to true.
  const hydratedRef = useRef(false);

  // ---- Diff logic ----
  useEffect(() => {
    if (!memberStats || !myProfile) return;

    // Find the current user's stats
    const me = memberStats.find((m) => m.userId === myProfile.userId);
    if (!me) return;

    const stats: UserStats = {
      totalExpenses: me.totalExpenses,
      ocrExpenses: me.ocrExpenses,
      manualExpenses: me.manualExpenses,
      totalAmount: me.totalAmount,
      streak: me.streak,
    };

    const earned = getEarnedBadges(stats);
    const earnedIds = new Set(earned.map((b) => b.id));

    // First hydration – just seed the seen set without triggering anything.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      // Merge whatever is already earned into the seen set so we don't
      // pop a wall of notifications on first load.
      const merged = new Set([...seenRef.current, ...earnedIds]);
      seenRef.current = merged;
      persistSeenBadgeIds(merged);
      return;
    }

    // Find badges earned now that haven't been shown yet.
    const newBadges = earned.filter((b) => !seenRef.current.has(b.id));

    if (newBadges.length > 0) {
      // Mark as seen immediately (even though animation hasn't played yet)
      // This prevents re-queuing on rapid Convex re-renders.
      const updated = new Set([...seenRef.current, ...newBadges.map((b) => b.id)]);
      seenRef.current = updated;
      persistSeenBadgeIds(updated);

      const now = Date.now();
      setQueue((prev) => [
        ...prev,
        ...newBadges.map((badge, i) => ({
          badge,
          queuedAt: now + i, // ordered
        })),
      ]);
    }
  }, [memberStats, myProfile]);

  // ---- Queue consumer: show one badge at a time ----
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [queue, current]);

  // ---- Dismiss current notification ----
  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  return { current, dismiss, queueLength: queue.length };
}
