import { useId } from "react";
import type { Badge } from "../../lib/badges";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BadgeEmblemProps {
  tier: Badge["tier"];
  emoji: string;
  earned?: boolean;
  size?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Wing path definitions – each tier adds visual complexity
// ---------------------------------------------------------------------------

interface WingPaths {
  left: string;
  right: string;
  leftTip?: string;
  rightTip?: string;
  leftAccent?: string;
  rightAccent?: string;
}

const WING_PATHS: Partial<Record<Badge["tier"], WingPaths>> = {
  silver: {
    left: "M42,82 L24,66 L20,88 L42,98 Z",
    right: "M158,82 L176,66 L180,88 L158,98 Z",
  },
  gold: {
    left: "M42,72 L16,46 L10,92 L42,108 Z",
    right: "M158,72 L184,46 L190,92 L158,108 Z",
  },
  platinum: {
    left: "M42,64 L10,34 L4,98 L42,116 Z",
    leftTip: "M12,36 L6,22 L9,40 Z",
    right: "M158,64 L190,34 L196,98 L158,116 Z",
    rightTip: "M188,36 L194,22 L191,40 Z",
  },
  diamond: {
    left: "M42,58 L8,26 L2,102 L42,120 Z",
    leftTip: "M10,28 L4,12 L7,32 Z",
    leftAccent: "M4,70 L0,60 L2,80 Z",
    right: "M158,58 L192,26 L198,102 L158,120 Z",
    rightTip: "M190,28 L196,12 L193,32 Z",
    rightAccent: "M196,70 L200,60 L198,80 Z",
  },
};

// ---------------------------------------------------------------------------
// Metallic color palettes – each tier has a distinct metallic look
// ---------------------------------------------------------------------------

interface TierPalette {
  light: string;
  mid: string;
  dark: string;
  border: string;
  innerDark: string;
  innerMid: string;
  glow: string;
  accent: string;
}

const PALETTES: Record<Badge["tier"], TierPalette> = {
  bronze: {
    light: "#e8b76a",
    mid: "#CD7F32",
    dark: "#8B5E2B",
    border: "#a0522d",
    innerDark: "#1a0d04",
    innerMid: "#3d2210",
    glow: "#cd7f32",
    accent: "#f5d5a0",
  },
  silver: {
    light: "#f0f0f0",
    mid: "#C0C0C0",
    dark: "#7A7A7A",
    border: "#909090",
    innerDark: "#0c0c14",
    innerMid: "#22222e",
    glow: "#c0c0c0",
    accent: "#e0e0e0",
  },
  gold: {
    light: "#fff4a3",
    mid: "#FFD700",
    dark: "#B8860B",
    border: "#DAA520",
    innerDark: "#1a1205",
    innerMid: "#3d2e0a",
    glow: "#ffd700",
    accent: "#ffe066",
  },
  platinum: {
    light: "#e0def0",
    mid: "#B8B4D0",
    dark: "#7A76A0",
    border: "#9592B0",
    innerDark: "#0c0a1a",
    innerMid: "#26223e",
    glow: "#c0bce0",
    accent: "#d8d4f8",
  },
  diamond: {
    light: "#c8f4ff",
    mid: "#60D6F8",
    dark: "#2A9EC4",
    border: "#40C4E0",
    innerDark: "#021822",
    innerMid: "#0e3a48",
    glow: "#60d6f8",
    accent: "#a0ecff",
  },
};

// ---------------------------------------------------------------------------
// Shield SVG paths (shared across tiers)
// viewBox: 0 0 200 220
// ---------------------------------------------------------------------------

const SHIELD_OUTER =
  "M100,22 C138,22 160,42 160,65 L160,132 C160,168 135,198 100,214 C65,198 40,168 40,132 L40,65 C40,42 62,22 100,22 Z";

const SHIELD_INNER =
  "M100,36 C130,36 148,52 148,70 L148,128 C148,158 128,184 100,198 C72,184 52,158 52,128 L52,70 C52,52 70,36 100,36 Z";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BadgeEmblem({
  tier,
  emoji,
  earned = true,
  size = 100,
  className = "",
}: BadgeEmblemProps) {
  // Unique IDs for SVG gradients (must be unique per instance)
  const uid = useId().replace(/:/g, "");
  const p = PALETTES[tier];
  const wings = WING_PATHS[tier];

  const showCrown = tier === "gold" || tier === "platinum" || tier === "diamond";
  const showGem = tier === "platinum" || tier === "diamond";
  const isDiamond = tier === "diamond";

  return (
    <div
      className={`badge-emblem ${earned ? "badge-emblem--earned" : "badge-emblem--locked"} ${className}`}
      style={
        {
          width: size,
          height: size * 1.1,
          "--emblem-glow": p.glow,
        } as React.CSSProperties
      }
    >
      <svg
        viewBox="0 0 200 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="badge-emblem__svg"
      >
        <defs>
          {/* Metallic gradient for shield body */}
          <linearGradient id={`em${uid}`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor={p.light} />
            <stop offset="28%" stopColor={p.mid} />
            <stop offset="52%" stopColor={p.dark} />
            <stop offset="72%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.light} />
          </linearGradient>

          {/* Inner dark plate gradient */}
          <radialGradient id={`ei${uid}`} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={p.innerMid} />
            <stop offset="100%" stopColor={p.innerDark} />
          </radialGradient>

          {/* Center glow */}
          <radialGradient id={`eg${uid}`} cx="50%" cy="44%" r="32%">
            <stop offset="0%" stopColor={p.glow} stopOpacity="0.35" />
            <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
          </radialGradient>

          {/* Wing gradient */}
          <linearGradient id={`ew${uid}`} x1="0" y1="0.2" x2="1" y2="0.8">
            <stop offset="0%" stopColor={p.light} stopOpacity="0.9" />
            <stop offset="50%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.dark} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* ====== Diamond outer aura rings ====== */}
        {isDiamond && earned && (
          <>
            <circle cx="100" cy="115" r="108" fill="none" stroke={p.glow} strokeWidth="0.6" opacity="0.2" />
            <circle cx="100" cy="115" r="102" fill="none" stroke={p.accent} strokeWidth="0.3" opacity="0.15" />
          </>
        )}

        {/* ====== Wing plates (silver and above) ====== */}
        {wings && (
          <>
            <path d={wings.left} fill={`url(#ew${uid})`} stroke={p.border} strokeWidth="1.5" />
            <path d={wings.right} fill={`url(#ew${uid})`} stroke={p.border} strokeWidth="1.5" />
            {wings.leftTip && wings.rightTip && (
              <>
                <path d={wings.leftTip} fill={`url(#em${uid})`} stroke={p.border} strokeWidth="1" />
                <path d={wings.rightTip} fill={`url(#em${uid})`} stroke={p.border} strokeWidth="1" />
              </>
            )}
            {wings.leftAccent && wings.rightAccent && (
              <>
                <path d={wings.leftAccent} fill={p.accent} opacity="0.5" />
                <path d={wings.rightAccent} fill={p.accent} opacity="0.5" />
              </>
            )}
          </>
        )}

        {/* ====== Main shield body (metallic) ====== */}
        <path d={SHIELD_OUTER} fill={`url(#em${uid})`} stroke={p.border} strokeWidth="2.5" />

        {/* Decorative inner border trim (gold+) */}
        {showCrown && (
          <path d={SHIELD_INNER} fill="none" stroke={p.accent} strokeWidth="0.8" opacity="0.35" />
        )}

        {/* ====== Inner dark plate (gem-like surface) ====== */}
        <path d={SHIELD_INNER} fill={`url(#ei${uid})`} />

        {/* Center glow effect */}
        {earned && <circle cx="100" cy="108" r="52" fill={`url(#eg${uid})`} />}

        {/* ====== Crown / Top accents ====== */}

        {/* Gold: simple triangular crown peak */}
        {showCrown && !showGem && (
          <polygon
            points="90,24 100,10 110,24"
            fill={p.accent}
            stroke={p.border}
            strokeWidth="1.2"
          />
        )}

        {/* Platinum: gem circle at apex */}
        {showGem && !isDiamond && (
          <>
            <polygon
              points="90,24 100,12 110,24"
              fill={p.accent}
              stroke={p.border}
              strokeWidth="0.8"
              opacity="0.5"
            />
            <circle cx="100" cy="14" r="7" fill={p.accent} stroke={p.border} strokeWidth="1.5" />
            <circle cx="100" cy="14" r="3.5" fill={p.light} opacity="0.7" />
          </>
        )}

        {/* Diamond: elaborate diamond-cut gem */}
        {isDiamond && (
          <>
            <polygon
              points="90,24 100,10 110,24"
              fill={p.accent}
              stroke={p.border}
              strokeWidth="0.8"
              opacity="0.5"
            />
            <polygon
              points="100,3 110,14 100,23 90,14"
              fill={p.accent}
              stroke={p.border}
              strokeWidth="1.5"
            />
            <circle cx="100" cy="13" r="4.5" fill={p.light} opacity="0.85" />
          </>
        )}

        {/* Inner glow ring (platinum / diamond) */}
        {(tier === "platinum" || isDiamond) && earned && (
          <ellipse
            cx="100"
            cy="112"
            rx="30"
            ry="40"
            fill="none"
            stroke={p.glow}
            strokeWidth="0.6"
            opacity="0.2"
          />
        )}
      </svg>

      {/* Emoji centered on the dark inner plate */}
      <span className="badge-emblem__emoji" style={{ fontSize: size * 0.35 }}>
        {earned ? emoji : "🔒"}
      </span>

      {/* Shimmer sweep overlay (earned only) */}
      {earned && <div className="badge-emblem__shimmer" />}
    </div>
  );
}
