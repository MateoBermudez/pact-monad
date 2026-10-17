/**
 * Line-art illustrations for PACT, in the friendly fintech style of the brief:
 * cream characters with a dark "ink" outline on lime panels, Monad coins ("M"),
 * sparkles and an escrow padlock. Colors come from the theme tokens so the art
 * stays in sync with the palette. Built as inline SVG + a little HTML/CSS for
 * the approval celebration.
 */

import { useEffect, useRef } from "react";

const INK = "var(--ink)";
const CREAM = "var(--card)";
const LIME = "var(--primary)";
const LIME_DEEP = "color-mix(in oklab, var(--primary), var(--ink) 16%)";
const MONO = '"Intropol", ui-sans-serif, system-ui, sans-serif';

/** A Monad coin. Pass `float` to make it bob gently (hero). */
function Coin({
  x,
  y,
  r = 22,
  label = "M",
  float,
  delay = 0,
}: {
  x: number;
  y: number;
  r?: number;
  label?: string;
  float?: boolean;
  delay?: number;
}) {
  return (
    <g className={float ? "ill-float" : undefined} style={float ? { animationDelay: `${delay}s` } : undefined}>
      <circle cx={x} cy={y} r={r} fill={LIME} stroke={INK} strokeWidth={5} />
      <circle cx={x} cy={y} r={r - 7} fill="none" stroke={INK} strokeWidth={2.5} opacity={0.45} />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={MONO}
        fontWeight={700}
        fontSize={r * 0.82}
        fill={INK}
      >
        {label}
      </text>
    </g>
  );
}

/** A 4-point concave sparkle. */
function Sparkle({ x, y, s = 14, fill = LIME }: { x: number; y: number; s?: number; fill?: string }) {
  const d = `M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`;
  return <path d={d} fill={fill} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
}

/** A small escrow padlock badge. */
function LockBadge({ x, y, r = 24 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={CREAM} stroke={INK} strokeWidth={5} />
      <path
        d={`M ${x - 6} ${y - 2} v -5 a 6 6 0 0 1 12 0 v 5`}
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <rect x={x - 9} y={y - 2} width={18} height={14} rx={3} fill={LIME} stroke={INK} strokeWidth={4} />
    </g>
  );
}

/** Landing composition built from the supplied vector artwork. */
export function IllustrationHero({ className }: { className?: string }) {
  return (
    <div
      className={`pact-hero-art ${className ?? ""}`}
      role="img"
      aria-label="Una persona con su billetera, rodeada de una moneda, un pagaré, un código QR y tarjetas de pago"
    >
      <div className="pact-hero-art__circle" />
      <img className="pact-hero-art__person" src="/illustrations/persona.svg" alt="" aria-hidden="true" width="1519" height="1688" fetchPriority="high" draggable={false} />
      <div className="pact-hero-art__symbol pact-hero-art__coin">
        <img src="/illustrations/moneda.svg" alt="" aria-hidden="true" width="692" height="720" draggable={false} />
      </div>
      <div className="pact-hero-art__symbol pact-hero-art__qr">
        <img src="/illustrations/qr.svg" alt="" aria-hidden="true" width="791" height="719" draggable={false} />
      </div>
      <div className="pact-hero-art__symbol pact-hero-art__cards">
        <img src="/illustrations/tarjeta.svg" alt="" aria-hidden="true" width="932" height="640" draggable={false} />
      </div>
      <div className="pact-hero-art__symbol pact-hero-art__receipt">
        <img src="/illustrations/pagare.svg" alt="" aria-hidden="true" width="890" height="823" draggable={false} />
      </div>
      <div className="pact-hero-art__symbol pact-hero-art__small-coin">
        <img src="/illustrations/moneda.svg" alt="" aria-hidden="true" width="692" height="720" draggable={false} />
      </div>
    </div>
  );
}
/**
 * Settings: a semicircular gauge that reads as "below the line the AI releases
 * on its own, above it needs your signature". Driven by the live setting:
 * `fraction` (0–1) sets both the lime "auto" arc and the needle.
 */
export function IllustrationGauge({ fraction, className }: { fraction: number; className?: string }) {
  const cx = 220;
  const cy = 250;
  const r = 140;
  const f = Math.min(1, Math.max(0, fraction));
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const ease = "cubic-bezier(.3,.8,.3,1.15)";
  return (
    <svg
      viewBox="0 0 440 300"
      className={className}
      role="img"
      aria-label={`Medidor: la IA libera pagos sola hasta el ${Math.round(f * 100)}% del rango; por encima se requiere tu firma`}
      style={{ width: "100%", height: "auto", overflow: "visible" }}
    >
      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* manual zone: the full track in ink (it doubles as the outline of the auto zone) */}
        <path d={arc} stroke={INK} strokeWidth={44} />
        {/* auto zone: lime inside the ink outline, drawn up to the threshold */}
        <circle cx={cx - r} cy={cy} r={15} fill={LIME} style={{ opacity: f > 0 ? 1 : 0, transition: "opacity .2s" }} />
        <path
          d={arc}
          pathLength={100}
          stroke={LIME}
          strokeWidth={30}
          strokeLinecap="butt"
          strokeDasharray={`${f * 100} 100`}
          style={{ transition: `stroke-dasharray .45s ${ease}` }}
        />

        {/* ticks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const t = (Math.PI * i) / 10;
          const x1 = cx - (r - 30) * Math.cos(t);
          const y1 = cy - (r - 30) * Math.sin(t);
          const x2 = cx - (r - 42) * Math.cos(t);
          const y2 = cy - (r - 42) * Math.sin(t);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={3} opacity={0.35} />;
        })}

        {/* needle: drawn pointing left (0), rotated clockwise by the threshold */}
        <g style={{ transform: `rotate(${f * 180}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: `transform .45s ${ease}` }}>
          <path d={`M ${cx} ${cy - 7} L ${cx - r + 46} ${cy} L ${cx} ${cy + 7} Z`} fill={INK} stroke={INK} strokeWidth={3} />
        </g>
        <circle cx={cx} cy={cy} r={18} fill={CREAM} stroke={INK} strokeWidth={6} />
        <circle cx={cx} cy={cy} r={5} fill={INK} />
      </g>

      {/* props: sparkle on the auto side, padlock on the signature side */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <Sparkle x={58} y={150} s={15} />
        <LockBadge x={384} y={150} r={22} />
        <Coin x={128} y={48} r={18} label="M" />
        <Coin x={318} y={52} r={14} label="M" />
      </g>
    </svg>
  );
}

/**
 * Approval celebration: a check that pops in while Monad coins burst outward.
 * Pure HTML/CSS so the motion is easy to control; plays once on mount.
 */
export function ApprovalCelebration({ amount, className = "" }: { amount: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Approval usually happens from the action buttons further down; bring the moment into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top < 0 || bottom > window.innerHeight) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
  }, []);
  const coins = [
    // Fan up and to the sides, never down into the caption.
    { x: -104, y: -58, r: 10, d: 0.05 },
    { x: 100, y: -64, r: -14, d: 0.12 },
    { x: -142, y: 4, r: 18, d: 0.18 },
    { x: 146, y: -6, r: -10, d: 0.1 },
    { x: -178, y: -34, r: 24, d: 0.22 },
    { x: 182, y: -40, r: -20, d: 0.16 },
    { x: -40, y: -82, r: 8, d: 0.08 },
    { x: 46, y: -84, r: -16, d: 0.26 },
  ];
  return (
    <div ref={ref} className={`relative flex flex-col items-center gap-4 ${className}`}>
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* expanding ring */}
        <span className="ring-pulse absolute inset-0 rounded-full border-2 border-ink" />
        {/* bursting coins */}
        {coins.map((c, i) => (
          <span
            key={i}
            className="burst-coin absolute flex items-center justify-center rounded-full bg-card font-mono text-[11px] font-bold text-primary-foreground"
            style={
              {
                height: 26,
                width: 26,
                border: "2px solid var(--ink)",
                ["--cx" as string]: `${c.x}px`,
                ["--cy" as string]: `${c.y}px`,
                ["--cr" as string]: `${c.r}deg`,
                animationDelay: `${c.d}s`,
              } as React.CSSProperties
            }
          >
            M
          </span>
        ))}
        {/* check */}
        <span className="pop-in relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-ink shadow-[var(--shadow-glow)]">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="var(--primary)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </div>
      <p className="font-display text-2xl font-bold text-primary-foreground">{amount} MON liberados al proveedor</p>
    </div>
  );
}
