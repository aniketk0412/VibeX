// Shared stroke icon set for app screens — one consistent 24-viewBox style, currentColor.
// Replaces scattered emoji/dingbats (🌐 ✉ ⚡ 🔒 …), which render as colored OS emoji and are
// the fastest way for a UI to read as AI-generated.

type P = { size?: number };

function Svg({ size = 16, children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export function IconLock({ size }: P) {
  return (
    <Svg size={size}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export function IconMail({ size }: P) {
  return (
    <Svg size={size}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7L22 7" />
    </Svg>
  );
}

export function IconZap({ size }: P) {
  return (
    <Svg size={size}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  );
}

export function IconGlobe({ size }: P) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  );
}

export function IconPlug({ size }: P) {
  return (
    <Svg size={size}>
      <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8zM12 18v4" />
    </Svg>
  );
}

export function IconTerminal({ size }: P) {
  return (
    <Svg size={size}>
      <path d="m4 17 6-6-6-6M12 19h8" />
    </Svg>
  );
}

export function IconSpark({ size }: P) {
  return (
    <Svg size={size}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </Svg>
  );
}
