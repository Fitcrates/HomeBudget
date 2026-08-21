import { useQuery } from "convex/react";
import { useState, useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  ALL_BADGES,
  TIER_COLORS,
  TIER_LABEL,
  getEarnedBadges,
  getNextBadges,
  type Badge,
  type UserStats,
} from "../../lib/badges";
import { BadgeEmblem } from "../ui/BadgeEmblem";
import { ScreenHeader } from "../ui/ScreenHeader";
import { TabBar } from "../ui/TabBar";
import { Spinner } from "../ui/Spinner";
import { AppCard } from "../ui/AppCard";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { Award, BarChart3, Camera, Edit, Flame, CheckCircle, Sprout, X } from "lucide-react";

interface Props {
  householdId: Id<"households">;
}

const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "diamond"] as const;

// Glow colors for the detail modal per tier
const TIER_GLOWS: Record<Badge["tier"], string> = {
  bronze: "rgba(205, 127, 50, 0.4)",
  silver: "rgba(192, 192, 192, 0.4)",
  gold: "rgba(255, 215, 0, 0.45)",
  platinum: "rgba(180, 175, 220, 0.45)",
  diamond: "rgba(96, 214, 248, 0.5)",
};

export function BadgesScreen({ householdId }: Props) {
  const memberStats = useQuery(api.analytics.householdMemberStats, { householdId });
  const myProfile = useQuery(api.profile.getMyProfile);
  const [tab, setTab] = useState<"achievements" | "fame" | "all">("achievements");
  const [selectedBadge, setSelectedBadge] = useState<{ badge: Badge; earned: boolean } | null>(null);

  // Compute the current user's earned badge IDs for the full list tab
  const myEarnedIds = useMemo(() => {
    if (!memberStats || !myProfile) return new Set<string>();
    const me = memberStats.find((m) => m.userId === myProfile.userId);
    if (!me) return new Set<string>();
    const stats: UserStats = {
      totalExpenses: me.totalExpenses,
      ocrExpenses: me.ocrExpenses,
      manualExpenses: me.manualExpenses,
      totalAmount: me.totalAmount,
      streak: me.streak,
    };
    return new Set(getEarnedBadges(stats).map((b) => b.id));
  }, [memberStats, myProfile]);

  if (!memberStats) {
    return <Spinner className="py-16" />;
  }

  return (
    <div className="space-y-8 pb-6">
      {/* Header */}
      <ScreenHeader
        icon={<Award />}
        title="Osiągnięcia"
        subtitle="Zbieraj odznaki za aktywność w domowym budżecie"
      />
      <TabBar
        tabs={[
          { key: "achievements" as const, label: "Zdobyte" },
          { key: "fame" as const, label: "Ranking" },
          { key: "all" as const, label: "Pełna Lista" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* ============ ACHIEVEMENTS TAB ============ */}
      {tab === "achievements" &&
        memberStats.map((member) => {
          const stats: UserStats = {
            totalExpenses: member.totalExpenses,
            ocrExpenses: member.ocrExpenses,
            manualExpenses: member.manualExpenses,
            totalAmount: member.totalAmount,
            streak: member.streak,
          };
          const earned = getEarnedBadges(stats);
          const next = getNextBadges(stats);

          return (
            <div key={member.userId} className="space-y-5">
              {/* Member header card */}
              <AppCard padding="md">
                <div className="flex items-center gap-4 mb-5">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.displayName}
                      className="h-14 w-14 rounded-xl object-cover border-[3px] border-orange-200 dark:border-white/10 shadow-sm transition-colors duration-700"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-orange-800 dark:text-indigo-200 font-medium text-xl border-[3px] border-orange-200 dark:border-white/10 transition-colors duration-700">
                      {member.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-orange-950 dark:text-white text-base truncate transition-colors duration-700">
                      {member.displayName}
                    </p>
                    <p className="text-xs text-orange-900/60 dark:text-white/50 font-medium truncate transition-colors duration-700">{member.email}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Award className="w-4 h-4 text-orange-600 dark:text-indigo-400 transition-colors duration-700" />
                      <span className="text-xs font-bold text-orange-600 dark:text-indigo-400 transition-colors duration-700">
                        {earned.length} / {ALL_BADGES.length} odznak
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                  <StatPill icon={BarChart3} value={member.totalExpenses} label="Wydatków" />
                  <StatPill icon={Camera} value={member.ocrExpenses} label="Skanów" />
                  <StatPill icon={Edit} value={member.manualExpenses} label="Ręcznych" />
                  <StatPill icon={Flame} value={member.streak} label="Dni z rzędu" />
                </div>
              </AppCard>

              {/* Earned badges – trophy grid */}
              {earned.length > 0 ? (
                <div className="space-y-4">
                  {TIER_ORDER.map((tier) => {
                    const tierBadges = earned.filter((b) => b.tier === tier);
                    if (tierBadges.length === 0) return null;
                    return (
                      <div key={tier} className="space-y-2">
                        <div className="flex items-center gap-2 ml-1">
                          <div
                            className={`h-2 w-2 rounded-full bg-gradient-to-r ${TIER_COLORS[tier]}`}
                          />
                          <span className="text-[10px] font-bold text-orange-900/40 dark:text-white/40 uppercase tracking-wider transition-colors duration-700">
                            {TIER_LABEL[tier]} ({tierBadges.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {tierBadges.map((badge) => (
                            <button
                              key={badge.id}
                              onClick={() => setSelectedBadge({ badge, earned: true })}
                              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/30 dark:bg-white/5 backdrop-blur-sm border border-white/40 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/10 transition-all active:scale-95"
                            >
                              <BadgeEmblem
                                tier={badge.tier}
                                emoji={badge.emoji}
                                earned
                                size={80}
                              />
                              <p className="text-[11px] font-medium text-orange-950 dark:text-white leading-tight text-center line-clamp-2 transition-colors duration-700">
                                {badge.name}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-orange-50 dark:bg-white/5 rounded-[16px] p-5 text-center shadow-sm transition-colors duration-700">
                  <Sprout className="w-12 h-12 text-orange-900/60 dark:text-white/50 mx-auto mb-2 transition-colors duration-700" />
                  <p className="text-sm font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                    Brak odznak — zacznij dodawać wydatki!
                  </p>
                </div>
              )}

              {/* Next badges to unlock */}
              {next.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-orange-900/60 dark:text-white/50 uppercase tracking-wider ml-2 transition-colors duration-700">
                    Następne do zdobycia
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {next.map((badge) => (
                      <button
                        key={badge.id}
                        onClick={() => setSelectedBadge({ badge, earned: false })}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/20 dark:bg-white/5 backdrop-blur-sm border border-orange-200/40 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/10 transition-all active:scale-95 duration-700"
                      >
                        <BadgeEmblem
                          tier={badge.tier}
                          emoji={badge.emoji}
                          earned={false}
                          size={70}
                        />
                        <p className="text-[10px] font-bold text-orange-900/40 dark:text-white/40 leading-tight text-center line-clamp-2 transition-colors duration-700">
                          {badge.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {/* ============ FAME (Hall of Glory) TAB ============ */}
      {tab === "fame" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-orange-950 to-orange-900 dark:from-neutral-900 dark:to-neutral-950 rounded-[16px] p-6 shadow-xl relative overflow-hidden transition-colors duration-700">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Flame className="w-32 h-32 text-white" />
            </div>
            <h3 className="text-xl font-medium text-white mb-6 relative z-10">
              Sala Chwały
            </h3>
            <div className="space-y-3 relative z-10">
              {memberStats
                .map((m) => {
                  const s: UserStats = {
                    totalExpenses: m.totalExpenses,
                    ocrExpenses: m.ocrExpenses,
                    manualExpenses: m.manualExpenses,
                    totalAmount: m.totalAmount,
                    streak: m.streak,
                  };
                  const memberEarned = getEarnedBadges(s);
                  // Find the highest-tier badge for showcase
                  const highestTier = TIER_ORDER.slice().reverse().find((t) =>
                    memberEarned.some((b) => b.tier === t)
                  );
                  const showcaseBadges = highestTier
                    ? memberEarned.filter((b) => b.tier === highestTier).slice(0, 3)
                    : [];
                  return {
                    member: m,
                    score: memberEarned.length,
                    showcaseBadges,
                  };
                })
                .sort((a, b) => b.score - a.score)
                .map((x, idx) => (
                  <div
                    key={x.member.userId}
                    className="flex items-center gap-4 bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/10"
                  >
                    <div className="w-8 flex justify-center text-xl font-black text-white/50">
                      #{idx + 1}
                    </div>
                    {x.member.avatarUrl ? (
                      <img
                        src={x.member.avatarUrl}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-white/20"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white font-medium text-lg">
                        {x.member.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {x.member.displayName}
                      </p>
                      <p className="text-white/60 text-xs font-bold">
                        {x.score} {x.score === 1 ? "odznaka" : "odznak"}
                      </p>
                      {/* Top badges showcase */}
                      {x.showcaseBadges.length > 0 && (
                        <div className="flex gap-0.5 mt-1.5">
                          {x.showcaseBadges.map((b) => (
                            <BadgeEmblem
                              key={b.id}
                              tier={b.tier}
                              emoji={b.emoji}
                              earned
                              size={32}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-2xl drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
                      {idx === 0 && "👑"}
                      {idx === 1 && "🥈"}
                      {idx === 2 && "🥉"}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ FULL LIST (Catalog) TAB ============ */}
      {tab === "all" && (
        <div className="space-y-8">
          <p className="text-[13px] font-bold text-orange-900/60 dark:text-white/50 text-center mb-2 transition-colors duration-700">
            Łącznie {ALL_BADGES.length} odznak do zebrania
          </p>
          {TIER_ORDER.map((tier) => {
            const tierBadges = ALL_BADGES.filter((b) => b.tier === tier);
            if (tierBadges.length === 0) return null;
            return (
              <div key={tier} className="space-y-3">
                {/* Ornate tier header */}
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className={`h-[2px] w-10 rounded-full bg-gradient-to-r ${TIER_COLORS[tier]}`} />
                  <span className="text-[11px] font-black text-orange-900 dark:text-white/80 uppercase tracking-widest transition-colors duration-700">
                    Poziom {TIER_LABEL[tier]}
                  </span>
                  <div className={`h-[2px] w-10 rounded-full bg-gradient-to-l ${TIER_COLORS[tier]}`} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {tierBadges.map((badge) => {
                    const isEarned = myEarnedIds.has(badge.id);
                    return (
                      <button
                        key={badge.id}
                        onClick={() => setSelectedBadge({ badge, earned: isEarned })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl backdrop-blur-sm border transition-all active:scale-95 duration-700 ${
                          isEarned
                            ? "bg-white/40 dark:bg-white/10 border-white/50 dark:border-white/20 hover:bg-white/55 dark:hover:bg-white/20"
                            : "bg-white/15 dark:bg-white/5 border-orange-200/30 dark:border-white/10 hover:bg-white/25 dark:hover:bg-white/10"
                        }`}
                      >
                        <BadgeEmblem
                          tier={badge.tier}
                          emoji={badge.emoji}
                          earned={isEarned}
                          size={80}
                        />
                        <p
                          className={`text-[11px] font-medium leading-tight text-center line-clamp-2 transition-colors duration-700 ${
                            isEarned ? "text-orange-950 dark:text-white" : "text-orange-900/40 dark:text-white/40"
                          }`}
                        >
                          {badge.name}
                        </p>
                        {isEarned && (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 dark:text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ BADGE DETAIL MODAL ============ */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge.badge}
          earned={selectedBadge.earned}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatPill (unchanged helper)
// ---------------------------------------------------------------------------

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: any;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-[16px] p-2.5 flex flex-col items-center gap-0.5 border border-white/60 dark:border-white/10 shadow-sm transition-colors duration-700">
      <Icon className="w-5 h-5 text-orange-600 dark:text-indigo-400 drop-shadow-sm transition-colors duration-700" />
      <span className="text-sm font-medium text-orange-950 dark:text-white mt-1 transition-colors duration-700">{value}</span>
      <span className="text-[9px] font-bold text-orange-900/40 dark:text-white/40 text-center leading-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] dark:drop-shadow-none transition-colors duration-700">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge Detail Modal – shows when tapping a badge emblem
// ---------------------------------------------------------------------------

function BadgeDetailModal({
  badge,
  earned,
  onClose,
}: {
  badge: Badge;
  earned: boolean;
  onClose: () => void;
}) {
  return (
    <div className="badge-detail-backdrop" onClick={onClose}>
      {/* Backdrop blur layer */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="badge-detail-card relative z-10 bg-gradient-to-b from-orange-50 to-orange-100 dark:from-neutral-900 dark:to-neutral-800 rounded-[16px] p-6 max-w-[300px] w-[90vw] border-2 border-white/60 dark:border-white/10 flex flex-col items-center text-center transition-colors duration-700"
        style={{
          boxShadow: `0 0 50px 8px ${TIER_GLOWS[badge.tier]}, 0 20px 50px rgba(0,0,0,0.2)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-orange-100/80 dark:bg-white/10 flex items-center justify-center text-orange-900/60 dark:text-white/50 hover:bg-orange-100 dark:hover:bg-white/20 transition-colors duration-700"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Emblem */}
        <BadgeEmblem
          tier={badge.tier}
          emoji={badge.emoji}
          earned={earned}
          size={130}
        />

        {/* Name */}
        <h3 className="text-xl font-medium text-orange-950 dark:text-white mt-3 leading-tight transition-colors duration-700">
          {badge.name}
        </h3>

        {/* Tier pill */}
        <div
          className={`inline-block mt-2 px-4 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-widest bg-gradient-to-r ${TIER_COLORS[badge.tier]} shadow-sm`}
        >
          {TIER_LABEL[badge.tier]}
        </div>

        {/* Description */}
        <p className="text-[13px] font-bold text-orange-900 dark:text-white/80 mt-3 leading-relaxed transition-colors duration-700">
          {badge.description}
        </p>

        {/* Earned indicator */}
        {earned ? (
          <div className="flex items-center gap-1.5 mt-3">
            <CheckCircle className="w-4 h-4 text-green-500 dark:text-emerald-400" />
            <span className="text-xs font-bold text-green-600 dark:text-emerald-400">Zdobyta!</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-xs font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">🔒 Jeszcze nie odblokowana</span>
          </div>
        )}

        {/* Dismiss button */}
        <ButtonPrimary
          size="sm"
          className="mt-4"
          onClick={onClose}
        >
          OK
        </ButtonPrimary>
      </div>
    </div>
  );
}
