// Vibex — custom brand logo (Vibe + Execute → a fast-forward » that means "auto-run it forward").
// Not the default Next/React starter logo.
//
//   <Logo />                       mark + wordmark
//   <Logo showWordmark={false} />  icon only
//   <Logo size={40} />             scale everything from one number

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export default function Logo({ size = 28, showWordmark = true, className }: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.4) }}
      aria-label="Vibex"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        role="img"
        aria-hidden={showWordmark ? true : undefined}
        style={{ display: "block", flex: "none" }}
      >
        <rect x="6" y="6" width="88" height="88" rx="24" fill="var(--accent)" />
        <g stroke="var(--glyph)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round">
          <path d="M30 33 L47 50 L30 67" />
          <path d="M48 33 L65 50 L48 67" />
        </g>
      </svg>

      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font)",
            fontWeight: 800,
            fontSize: Math.round(size * 0.86),
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "var(--text)",
          }}
        >
          Vibe<span style={{ color: "var(--accent)" }}>x</span>
        </span>
      )}
    </span>
  );
}
