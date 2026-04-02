import { useQuery } from "convex/react";
import { useState } from "react";
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
import { Award, BarChart3, Camera, Edit, Flame, CheckCircle, Sprout } from "lucide-react";

interface Props {
  householdId: Id<"households">;
}

const TIER_ORDER = ["diamond", "platinum", "gold", "silver", "bronze"] as const;

export function BadgesScreen({ householdId }: Props) {
  const memberStats = useQuery(api.analytics.householdMemberStats, { householdId });
  const [tab, setTab] = useState<"achievements" | "fame" | "all">("achievements");

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
          <Award className="w-8 h-8 text-[#c76823] drop-shadow-sm" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">Osiągnięcia</h2>
        </div>
        <p className="text-[14px] text-[#6d4d38] font-bold ml-1 drop-shadow-sm">
          Zbieraj odznaki za aktywność w domowym budżecie
        </p>
        <div className="flex bg-[#fdf9f1] rounded-2xl p-1 shadow-[0_4px_12px_rgba(180,120,80,0.1)] gap-1">
          <button
            onClick={() => setTab("achievements")}
            className={`flex-1 py-2.5 text-[13px] font-extrabold rounded-xl transition-all ${
              tab === "achievements"
                ? "bg-white text-[#cf833f] shadow-sm ring-1 ring-[#ede0d4]/60"
                : "text-[#aa9382] hover:text-[#cf833f] hover:bg-[#f6eedf]"
            }`}
          >
            Zdobyte
          </button>
          <button
            onClick={() => setTab("fame")}
            className={`flex-1 py-2.5 text-[13px] font-extrabold rounded-xl transition-all ${
              tab === "fame"
                ? "bg-white text-[#cf833f] shadow-sm ring-1 ring-[#ede0d4]/60"
                : "text-[#aa9382] hover:text-[#cf833f] hover:bg-[#f6eedf]"
            }`}
          >
            Ranking
          </button>
          <button
            onClick={() => setTab("all")}
            className={`flex-1 py-2.5 text-[13px] font-extrabold rounded-xl transition-all ${
              tab === "all"
                ? "bg-white text-[#cf833f] shadow-sm ring-1 ring-[#ede0d4]/60"
                : "text-[#aa9382] hover:text-[#cf833f] hover:bg-[#f6eedf]"
            }`}
          >
            Pełna Lista
          </button>
        </div>
      </div>

      {tab === "achievements" && memberStats.map((member) => {
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
                    <Award className="w-4 h-4 text-[#cf833f]" />
                    <span className="text-xs font-bold text-[#cf833f]">
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
                <Sprout className="w-12 h-12 text-[#8a7262] mx-auto mb-2" />
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

      {tab === "fame" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#2b180a] to-[#4a2e1b] rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Flame className="w-32 h-32 text-white" />
            </div>
            <h3 className="text-xl font-extrabold text-white mb-6 relative z-10">
              Sala Chwały
            </h3>
            <div className="space-y-3 relative z-10">
              {memberStats
                .map((m) => {
                  const s = {
                    totalExpenses: m.totalExpenses,
                    ocrExpenses: m.ocrExpenses,
                    manualExpenses: m.manualExpenses,
                    totalAmount: m.totalAmount,
                    streak: m.streak,
                  };
                  return {
                    member: m,
                    score: getEarnedBadges(s).length,
                  };
                })
                .sort((a, b) => b.score - a.score)
                .map((x, idx) => (
                  <div key={x.member.userId} className="flex items-center gap-4 bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                    <div className="w-8 flex justify-center text-xl font-black text-white/50">
                      #{idx + 1}
                    </div>
                    {x.member.avatarUrl ? (
                      <img src={x.member.avatarUrl} className="w-12 h-12 rounded-xl object-cover border-2 border-white/20" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white font-extrabold text-lg">
                        {x.member.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-extrabold truncate">{x.member.displayName}</p>
                      <p className="text-white/60 text-xs font-bold">{x.score} {x.score === 1 ? "odznaka" : "odznak"}</p>
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

      {tab === "all" && (
        <div className="space-y-6">
          <p className="text-[13px] font-bold text-[#8a7262] text-center mb-2">
            Łącznie {ALL_BADGES.length} odznak do zebrania
          </p>
          {TIER_ORDER.map((tier) => {
            const tierBadges = ALL_BADGES.filter((b) => b.tier === tier);
            if (tierBadges.length === 0) return null;
            return (
              <div key={tier} className="space-y-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className={`h-1.5 w-8 rounded-full bg-gradient-to-r ${TIER_COLORS[tier]}`} />
                  <span className="text-[11px] font-black text-[#6d4d38] uppercase tracking-widest">
                    Poziom {TIER_LABEL[tier]}
                  </span>
                  <div className={`h-1.5 w-8 rounded-full bg-gradient-to-l ${TIER_COLORS[tier]}`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {tierBadges.map((badge) => (
                    <div key={badge.id} className="relative aspect-square flex flex-col items-center justify-center p-3 text-center bg-white/50 backdrop-blur-sm border border-[#ede0d4] rounded-3xl shadow-[0_2px_8px_rgba(180,120,80,0.05)]">
                      <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-[10px] bg-gradient-to-br ${TIER_COLORS[tier]} text-white font-black shadow-md border-2 border-white`}>
                         {badge.tier.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-4xl drop-shadow-md mb-2">{badge.emoji}</span>
                      <p className="font-extrabold text-[12px] text-[#2b180a] leading-tight mb-1">{badge.name}</p>
                      <p className="text-[9px] font-bold text-[#b89b87] leading-snug px-1 line-clamp-3">{badge.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    <div className="bg-white/60 backdrop-blur-md rounded-2xl p-2.5 flex flex-col items-center gap-0.5 border border-white/60 shadow-sm">
      <Icon className="w-5 h-5 text-[#c76823] drop-shadow-sm" />
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
      {earned && (
        <CheckCircle className="w-5 h-5 text-green-500 shrink-0 drop-shadow-sm" />
      )}
    </div>
  );
}
