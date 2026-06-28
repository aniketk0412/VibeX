// Tiny presentation helpers shared by the dashboard and project screens.

// "Updated 3 hours ago" style relative time. Falls back to a date for anything older than a week.
export function timeAgo(date: Date, now: number = Date.now()): string {
  const ms = now - date.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Time-of-day greeting, computed on the server in the host timezone.
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// First name for a friendly greeting; falls back to the email local-part, then a default.
export function firstName(name?: string | null, email?: string | null): string {
  const n = (name || "").trim();
  if (n) return n.split(/\s+/)[0];
  const e = (email || "").trim();
  if (e) return e.split("@")[0];
  return "there";
}
