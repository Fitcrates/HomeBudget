import { useEffect, useRef, useCallback, useState } from "react";
import { TIER_COLORS, TIER_LABEL, type Badge } from "../../lib/badges";
import { BadgeEmblem } from "./BadgeEmblem";

// ---------------------------------------------------------------------------
// Canvas-based confetti (zero-dependency, lightweight)
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  shape: "circle" | "rect" | "star";
}

const TIER_CONFETTI_PALETTES: Record<Badge["tier"], string[]> = {
  bronze: ["#cd7f32", "#e8a862", "#a0522d", "#f5d5a0", "#fff8e7"],
  silver: ["#c0c0c0", "#e8e8e8", "#808080", "#d4d4d4", "#ffffff"],
  gold: ["#ffd700", "#ffec80", "#b8860b", "#fff4cc", "#ffe066"],
  platinum: ["#e5e4e2", "#c9c6f0", "#9e9e9e", "#d8d6f5", "#ffffff"],
  diamond: ["#b9f2ff", "#60d6f8", "#9ef0ff", "#ffffff", "#40c4e0"],
};

function createParticle(canvasW: number, canvasH: number, palette: string[]): Particle {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
  const speed = 4 + Math.random() * 8;
  const shapes: Particle["shape"][] = ["circle", "rect", "star"];
  return {
    x: canvasW / 2 + (Math.random() - 0.5) * canvasW * 0.3,
    y: canvasH * 0.55,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 4 + Math.random() * 6,
    color: palette[Math.floor(Math.random() * palette.length)],
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.3,
    life: 0,
    maxLife: 60 + Math.random() * 60,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = 1 - p.life / p.maxLife;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === "rect") {
    ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
  } else {
    // 5-point star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? p.size : p.size * 0.4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ShimmerRing removed – BadgeEmblem handles all visual richness

// ---------------------------------------------------------------------------
// Sound effect (tiny inline beep – no external file needed)
// ---------------------------------------------------------------------------
function playUnlockSound() {
  try {
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    // Rising two-note chime
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ac.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ac.currentTime + 0.12); // E5
    osc.frequency.setValueAtTime(783.99, ac.currentTime + 0.24); // G5

    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.5);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.5);
  } catch {
    // Audio not available – silent fallback
  }
}

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

interface BadgeUnlockOverlayProps {
  badge: Badge;
  onDismiss: () => void;
  remaining: number;
}

const AUTO_DISMISS_MS = 4500;

export function BadgeUnlockOverlay({ badge, onDismiss, remaining }: BadgeUnlockOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const [phase, setPhase] = useState<"enter" | "idle" | "exit">("enter");

  // ---- Confetti lifecycle ----
  const spawnConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const palette = TIER_CONFETTI_PALETTES[badge.tier];
    const count = badge.tier === "diamond" ? 80 : badge.tier === "platinum" ? 65 : 50;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle(canvas.width, canvas.height, palette));
    }
  }, [badge.tier]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn initial burst
    spawnConfetti();
    playUnlockSound();

    // Second burst after 400ms
    const burst2 = setTimeout(() => spawnConfetti(), 400);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.99; // drag
        p.rotation += p.rotationSpeed;
        p.life++;
        drawParticle(ctx, p);
      }
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(burst2);
      window.removeEventListener("resize", resize);
    };
  }, [spawnConfetti]);

  // ---- Phase transitions ----
  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase("idle"), 100);
    return () => clearTimeout(enterTimer);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase("exit");
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "exit") {
      const t = setTimeout(onDismiss, 400);
      return () => clearTimeout(t);
    }
  }, [phase, onDismiss]);

  // ---- Click to dismiss ----
  const handleDismiss = useCallback(() => {
    setPhase("exit");
  }, []);

  // Tier-specific glow color for the card border
  const tierGlows: Record<Badge["tier"], string> = {
    bronze: "rgba(205, 127, 50, 0.5)",
    silver: "rgba(192, 192, 192, 0.5)",
    gold: "rgba(255, 215, 0, 0.5)",
    platinum: "rgba(180, 175, 220, 0.5)",
    diamond: "rgba(96, 214, 248, 0.6)",
  };

  return (
    <div
      className={`badge-overlay-backdrop ${phase === "enter" ? "badge-overlay-backdrop--entering" : ""} ${phase === "exit" ? "badge-overlay-backdrop--exiting" : ""}`}
      onClick={handleDismiss}
      role="dialog"
      aria-label={`Odblokowano odznakę: ${badge.name}`}
    >
      {/* Full-screen confetti canvas */}
      <canvas
        ref={canvasRef}
        className="badge-confetti-canvas"
      />

      {/* Card */}
      <div
        className={`badge-overlay-card ${phase === "idle" ? "badge-overlay-card--visible" : ""} ${phase === "exit" ? "badge-overlay-card--exiting" : ""}`}
        style={{
          boxShadow: `0 0 60px 10px ${tierGlows[badge.tier]}, 0 20px 60px rgba(0,0,0,0.2)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top label */}
        <div className="badge-overlay-label">
          <span className="badge-overlay-label-text">NOWA ODZNAKA!</span>
        </div>

        {/* Ornate badge emblem */}
        <div className="badge-overlay-emoji-wrap">
          <BadgeEmblem
            tier={badge.tier}
            emoji={badge.emoji}
            earned
            size={150}
          />
        </div>

        {/* Name */}
        <h2 className="badge-overlay-name">{badge.name}</h2>

        {/* Tier pill */}
        <div
          className={`badge-overlay-tier bg-gradient-to-r ${TIER_COLORS[badge.tier]}`}
        >
          {TIER_LABEL[badge.tier]}
        </div>

        {/* Description */}
        <p className="badge-overlay-desc">{badge.description}</p>

        {/* Dismiss button */}
        <button
          className="badge-overlay-dismiss"
          onClick={handleDismiss}
        >
          Świetnie! 🎉
        </button>

        {/* Queue indicator */}
        {remaining > 0 && (
          <p className="badge-overlay-remaining">
            +{remaining} {remaining === 1 ? "kolejna odznaka" : "kolejne odznaki"}
          </p>
        )}
      </div>
    </div>
  );
}
