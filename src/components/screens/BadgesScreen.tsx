import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  ALL_BADGES,
  TIER_BG,
  TIER_COLORS,
  TIER_LABEL,
  getEarnedBadges,
  getNextBadges,
  type Badge,
  type UserStats,
} from "../../lib/badges";

interface Props {
  householdId: Id<"households">;
}

const TIER_ORDER = ["platinum", "gold", "silver", "bronze"] as const;

export function BadgesScreen({ householdId }: Props) {
  const memberStats = useQuery(api.analytics.householdMemberStats, { householdId });

  if (!memberStats) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-6">
      {/* Header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-3xl drop-shadow-sm">🏅</span>
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">Osiągnięcia</h2>
        </div>
        <p className="text-[14px] text-[#6d4d38] font-bold ml-1 drop-shadow-sm">
          Zbieraj odznaki za aktywność w domowym budżecie
        </p>
      </div>

      {memberStats.map((member) => {
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
          <div key={member.userId} className="space-y-4">
            {/* Member header */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-5 shadow-[0_8px_32px_rgba(180,120,80,0.15)]">
              <div className="flex items-center gap-4 mb-5">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.displayName}
                    className="h-14 w-14 rounded-2xl object-cover border-[3px] border-[#f2d6bf] shadow-sm"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f8e8d6] to-[#f2d6bf] flex items-center justify-center text-[#8a4f2a] font-extrabold text-xl border-[3px] border-[#f2d6bf]">
                    {member.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[#2b180a] text-base truncate">
                    {member.displayName}
                  </p>
                  <p className="text-xs text-[#8a7262] font-semibold truncate">{member.email}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm">🏅</span>
                    <span className="text-xs font-bold text-[#cf833f]">
                      {earned.length} / {ALL_BADGES.length} odznak
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2">
                <StatPill emoji="📊" value={member.totalExpenses} label="Wydatków" />
                <StatPill emoji="📷" value={member.ocrExpenses} label="Skanów" />
                <StatPill emoji="✍️" value={member.manualExpenses} label="Ręcznych" />
                <StatPill emoji="🔥" value={member.streak} label="Dni z rzędu" />
              </div>
            </div>

            {/* Earned badges */}
            {earned.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#8a7262] uppercase tracking-wider ml-2">
                  Zdobyte odznaki ({earned.length})
                </h3>
                {TIER_ORDER.map((tier) => {
                  const tierBadges = earned.filter((b) => b.tier === tier);
                  if (tierBadges.length === 0) return null;
                  return (
                    <div key={tier} className="space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <div
                          className={`h-2 w-2 rounded-full bg-gradient-to-r ${TIER_COLORS[tier]}`}
                        />
                        <span className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider">
                          {TIER_LABEL[tier]}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {tierBadges.map((badge) => (
                          <BadgeCard key={badge.id} badge={badge} earned />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#fdf9f1] rounded-2xl p-5 text-center shadow-sm">
                <p className="text-3xl mb-2">🌱</p>
                <p className="text-sm font-bold text-[#8a7262]">
                  Brak odznak — zacznij dodawać wydatki!
                </p>
              </div>
            )}

            {/* Next badges to unlock */}
            {next.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#8a7262] uppercase tracking-wider ml-2">
                  Następne do zdobycia
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {next.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} earned={false} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatPill({
  emoji,
  value,
  label,
}: {
  emoji: string;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center gap-0.5 border border-white/60 shadow-sm">
      <span className="text-xl drop-shadow-sm">{emoji}</span>
      <span className="text-sm font-extrabold text-[#2b180a] mt-1">{value}</span>
      <span className="text-[9px] font-bold text-[#b89b87] text-center leading-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">{label}</span>
    </div>
  );
}

function BadgeCard({ badge, earned }: { badge: Badge; earned: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${
        earned
          ? `${TIER_BG[badge.tier]} shadow-sm border border-white/60`
          : "bg-white/40 border border-[#ede0d4]/60 opacity-60 backdrop-blur-sm"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[26px] shrink-0 ${
          earned
            ? `bg-gradient-to-br ${TIER_COLORS[badge.tier]} shadow-md border-[2.5px] border-white/40 drop-shadow-lg`
            : "bg-[#f5e5cf] border border-[#ebd8c8]"
        }`}
      >
        <span className={earned ? "drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]" : "grayscale opacity-40"}>{badge.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-extrabold text-[15px] ${earned ? "text-[#2b180a]" : "text-[#b89b87]"}`}>
            {badge.name}
          </p>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
              earned
                ? `bg-gradient-to-r ${TIER_COLORS[badge.tier]} text-white shadow-sm`
                : "bg-[#f5e5cf]/60 text-[#b89b87]"
            }`}
          >
            {TIER_LABEL[badge.tier]}
          </span>
        </div>
        <p className={`text-[12px] mt-1 font-semibold leading-snug ${earned ? "text-[#6d4d38]" : "text-[#c0a898]"}`}>
          {badge.description}
        </p>
      </div>
      {earned && <span className="text-xl shrink-0 drop-shadow-sm">✅</span>}
    </div>
  );
}
