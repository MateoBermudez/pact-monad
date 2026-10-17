"use client";

/**
 * Hero illustration for PACT: a person leaning out of a giant wallet, pointing at
 * the sky while their other hand taps the contactless mark. Around them: a QR
 * scan frame, a payment card, a receipt and Monad coins. Everything that can
 * move does (scan line, waving arm, tapping hand, wifi waves, falling coin).
 */

const INK = "var(--ink)";
const CREAM = "var(--card)";
const LIME = "var(--primary)";
const LIME_DEEP = "color-mix(in oklab, var(--primary), var(--ink) 18%)";
const MONO = '"Intropol", ui-sans-serif, system-ui, sans-serif';

function Coin({
  x,
  y,
  r = 22,
  label = "M",
  delay = 0,
}: {
  x: number;
  y: number;
  r?: number;
  label?: string;
  delay?: number;
}) {
  return (
    <g className="ill-float" style={{ animationDelay: `${delay}s` }}>
      <circle cx={x} cy={y} r={r} fill={LIME} stroke={INK} strokeWidth={5} />
      <circle
        cx={x}
        cy={y}
        r={r - 7}
        fill="none"
        stroke={INK}
        strokeWidth={2.5}
        opacity={0.4}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={MONO}
        fontWeight={700}
        fontSize={r * 0.85}
        fill={INK}
      >
        {label}
      </text>
    </g>
  );
}

function Sparkle({
  x,
  y,
  s = 14,
  delay = 0,
  fill = LIME,
}: {
  x: number;
  y: number;
  s?: number;
  delay?: number;
  fill?: string;
}) {
  const d = `M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`;
  return (
    <path
      d={d}
      fill={fill}
      stroke={INK}
      strokeWidth={3}
      strokeLinejoin="round"
      className="ill-twinkle"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

export function IllustrationHero({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 470"
      className={className}
      role="img"
      aria-label="Una persona asoma de una billetera gigante señalando hacia arriba, rodeada de monedas MON, una tarjeta y un código QR"
      style={{ width: "100%", height: "auto", overflow: "visible" }}
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* soft backdrop disc */}
        <circle cx={214} cy={236} r={150} fill={LIME_DEEP} />

        {/* ---- QR scan frame (top) ---- */}
        <g transform="translate(150 22)">
          <path
            d="M0 16 V4 a4 4 0 0 1 4 -4 H16 M44 0 H56 a4 4 0 0 1 4 4 V16 M60 44 V56 a4 4 0 0 1 -4 4 H44 M16 60 H4 a4 4 0 0 1 -4 -4 V44"
            fill="none"
            stroke={INK}
            strokeWidth={5}
          />
          {/* tiny QR pattern */}
          <g fill={INK}>
            <rect x={13} y={13} width={12} height={12} rx={2} />
            <rect x={35} y={13} width={12} height={12} rx={2} />
            <rect x={13} y={35} width={12} height={12} rx={2} />
            <rect x={35} y={35} width={5} height={5} />
            <rect x={42} y={42} width={5} height={5} />
            <rect x={28} y={28} width={4} height={4} />
          </g>
          <g fill={LIME}>
            <rect x={17} y={17} width={4} height={4} />
            <rect x={39} y={17} width={4} height={4} />
            <rect x={17} y={39} width={4} height={4} />
          </g>
          {/* moving scan line */}
          <g className="ill-scan">
            <rect
              x={-4}
              y={8}
              width={68}
              height={5}
              rx={2.5}
              fill={LIME}
              stroke={INK}
              strokeWidth={2.5}
            />
          </g>
        </g>

        {/* ---- payment card (top right) ---- */}
        <g className="ill-tilt">
          <rect
            x={298}
            y={66}
            width={92}
            height={58}
            rx={9}
            fill={CREAM}
            stroke={INK}
            strokeWidth={5}
          />
          <rect x={298} y={82} width={92} height={13} fill={INK} />
          <rect
            x={308}
            y={104}
            width={26}
            height={10}
            rx={3}
            fill={LIME}
            stroke={INK}
            strokeWidth={3}
          />
          <circle
            cx={372}
            cy={108}
            r={6}
            fill={LIME}
            stroke={INK}
            strokeWidth={3}
          />
          <circle
            cx={362}
            cy={108}
            r={6}
            fill={CREAM}
            stroke={INK}
            strokeWidth={3}
          />
        </g>

        {/* ---- coin top-left ---- */}
        <Coin x={72} y={96} r={24} label="$" delay={0.4} />

        {/* ---- receipt (left) ---- */}
        <g transform="rotate(-14 66 340)" className="ill-bob">
          <path
            d="M40 304 h54 v66 l-9 -6 -9 6 -9 -6 -9 6 -9 -6 -9 6 Z"
            fill={CREAM}
            stroke={INK}
            strokeWidth={5}
          />
          <path
            d="M52 322 h30 M52 334 h30 M52 346 h18"
            stroke={INK}
            strokeWidth={4}
          />
          <circle
            cx={78}
            cy={348}
            r={5}
            fill={LIME}
            stroke={INK}
            strokeWidth={2.5}
          />
        </g>

        {/* ---- the person ---- */}
        {/* torso (the wallet hides the lower half) */}
        <path
          d="M148 330 L154 262 Q158 226 206 222 Q256 226 262 262 L268 330 Z"
          fill={CREAM}
          stroke={INK}
          strokeWidth={5.5}
        />
        {/* shirt folds */}
        <path
          d="M176 258 q10 8 6 22 M236 252 q-8 10 -3 24 M200 292 q8 4 16 0"
          fill="none"
          stroke={INK}
          strokeWidth={3.5}
          opacity={0.7}
        />

        {/* raised arm: shoulder → elbow → hand, pivoting on the shoulder */}
        <g className="ill-wave" style={{ transformOrigin: "166px 256px" }}>
          <path
            d="M166 256 Q128 262 112 226 Q104 204 108 176"
            fill="none"
            stroke={INK}
            strokeWidth={31}
          />
          <path
            d="M166 256 Q128 262 112 226 Q104 204 108 176"
            fill="none"
            stroke={CREAM}
            strokeWidth={21}
          />
          {/* cuff line */}
          <path
            d="M97 184 q11 8 22 0"
            fill="none"
            stroke={INK}
            strokeWidth={4}
          />
          {/* hand: fist + pointing finger */}
          <rect
            x={101}
            y={116}
            width={13}
            height={44}
            rx={6.5}
            fill={CREAM}
            stroke={INK}
            strokeWidth={5}
          />
          <path
            d="M96 152 q-4 28 12 32 q22 4 24 -18 q0 -14 -12 -14 h-14 Z"
            fill={CREAM}
            stroke={INK}
            strokeWidth={5}
          />
          <path
            d="M114 160 q6 3 12 0 M112 170 q6 3 12 0"
            fill="none"
            stroke={INK}
            strokeWidth={3.2}
          />
        </g>

        {/* neck */}
        <path
          d="M196 196 h24 v32 q-12 10 -24 0 Z"
          fill={CREAM}
          stroke={INK}
          strokeWidth={5.5}
        />
        {/* collar */}
        <path
          d="M186 228 Q208 246 232 228"
          fill="none"
          stroke={INK}
          strokeWidth={5}
        />

        {/* head, turned left to look at the pointing hand */}
        <g className="ill-bob" style={{ transformOrigin: "212px 196px" }}>
          <ellipse
            cx={214}
            cy={158}
            rx={38}
            ry={42}
            fill={CREAM}
            stroke={INK}
            strokeWidth={5.5}
          />
          {/* ear */}
          <path
            d="M246 156 q12 0 10 14 q-2 12 -14 8"
            fill={CREAM}
            stroke={INK}
            strokeWidth={4.5}
          />
          {/* hair: swept-up quiff */}
          <path
            d="M178 150 C170 104 214 86 250 104 C262 112 260 134 252 150 C244 128 226 118 206 122 C192 124 182 136 178 150 Z"
            fill={INK}
          />
          <path
            d="M206 100 C218 82 244 84 256 98 C246 96 232 98 224 106 Z"
            fill={INK}
          />
          {/* face: eye, brow, nose, smile */}
          <circle cx={198} cy={156} r={4.2} fill={INK} />
          <path
            d="M188 144 q10 -6 20 -1"
            fill="none"
            stroke={INK}
            strokeWidth={3.5}
          />
          <path
            d="M178 168 q-5 6 1 9 h6"
            fill="none"
            stroke={INK}
            strokeWidth={4}
          />
          <path
            d="M190 184 q12 10 26 -2"
            fill="none"
            stroke={INK}
            strokeWidth={4.2}
          />
        </g>

        {/* ---- the wallet ---- */}
        <g>
          <rect
            x={64}
            y={300}
            width={282}
            height={150}
            rx={28}
            fill={CREAM}
            stroke={INK}
            strokeWidth={5.5}
          />
          {/* stitching */}
          <rect
            x={78}
            y={314}
            width={254}
            height={122}
            rx={18}
            fill="none"
            stroke={INK}
            strokeWidth={2.6}
            strokeDasharray="7 7"
            opacity={0.75}
          />
          {/* clasp tab */}
          <rect
            x={32}
            y={352}
            width={84}
            height={62}
            rx={18}
            fill={CREAM}
            stroke={INK}
            strokeWidth={5.5}
          />
          <circle
            cx={62}
            cy={383}
            r={11}
            fill={LIME}
            stroke={INK}
            strokeWidth={5}
          />
          {/* card peeking out */}
          <rect
            x={150}
            y={286}
            width={78}
            height={30}
            rx={8}
            fill={LIME}
            stroke={INK}
            strokeWidth={5}
            transform="rotate(-6 189 301)"
          />
        </g>

        {/* contactless mark on the wallet */}
        <g
          transform="translate(262 372) rotate(45)"
          fill="none"
          stroke={INK}
          strokeWidth={5}
        >
          <circle cx={0} cy={0} r={3.5} fill={INK} stroke="none" />
          <path d="M9 -9 a13 13 0 0 1 0 18" className="ill-wifi" />
          <path
            d="M18 -18 a26 26 0 0 1 0 36"
            className="ill-wifi"
            style={{ animationDelay: ".25s" }}
          />
          <path
            d="M27 -26 a38 38 0 0 1 0 52"
            className="ill-wifi"
            style={{ animationDelay: ".5s" }}
          />
        </g>

        {/* other hand: resting on the wallet, tapping */}
        <g className="ill-tap">
          <path
            d="M268 262 Q312 276 304 316"
            fill="none"
            stroke={INK}
            strokeWidth={31}
          />
          <path
            d="M268 262 Q312 276 304 316"
            fill="none"
            stroke={CREAM}
            strokeWidth={21}
          />
          <path
            d="M290 322 q-2 -16 12 -18 q16 -2 18 12 q2 16 -12 20 q-16 4 -18 -14 Z"
            fill={CREAM}
            stroke={INK}
            strokeWidth={5}
          />
          <path
            d="M296 332 q8 4 16 0"
            fill="none"
            stroke={INK}
            strokeWidth={3.2}
          />
        </g>

        {/* a coin dropping into the wallet, forever */}
        <g className="ill-drop">
          <circle
            cx={332}
            cy={236}
            r={13}
            fill={LIME}
            stroke={INK}
            strokeWidth={4.5}
          />
          <text
            x={332}
            y={237}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={MONO}
            fontWeight={700}
            fontSize={11}
            fill={INK}
          >
            M
          </text>
        </g>

        {/* extras */}
        <Coin x={364} y={236} r={20} label="M" delay={1.1} />
        <Sparkle x={134} y={64} s={14} />
        <Sparkle x={380} y={182} s={11} delay={0.8} fill={INK} />
        <Sparkle x={30} y={248} s={12} delay={1.4} />
      </g>
    </svg>
  );
}
