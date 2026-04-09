import { createContext, useContext, type ReactNode } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import {
  useBadgeNotifications,
  type BadgeNotification,
} from "../../hooks/useBadgeNotifications";
import { BadgeUnlockOverlay } from "../ui/BadgeUnlockOverlay";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface BadgeNotificationContextValue {
  /** The badge currently being displayed (null = nothing showing). */
  current: BadgeNotification | null;
  /** How many badges remain in the queue after the current one. */
  queueLength: number;
}

const BadgeNotificationContext = createContext<BadgeNotificationContextValue>({
  current: null,
  queueLength: 0,
});

/** Optional consumer hook – components can check if a badge is being shown. */
export function useBadgeNotificationState() {
  return useContext(BadgeNotificationContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface Props {
  householdId: Id<"households"> | null;
  children: ReactNode;
}

/**
 * Wrap the app (or the authenticated section) with this provider.
 * It subscribes to Convex stats, detects newly earned badges, and renders
 * the full-screen overlay animation automatically.
 */
export function BadgeNotificationProvider({ householdId, children }: Props) {
  const { current, dismiss, queueLength } = useBadgeNotifications(householdId);

  return (
    <BadgeNotificationContext.Provider value={{ current, queueLength }}>
      {children}

      {/* Overlay – rendered as a portal-like fixed layer */}
      {current && (
        <BadgeUnlockOverlay
          key={current.badge.id}
          badge={current.badge}
          onDismiss={dismiss}
          remaining={queueLength}
        />
      )}
    </BadgeNotificationContext.Provider>
  );
}
