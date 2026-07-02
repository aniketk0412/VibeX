// Client-side capture of a preview iframe → a PNG data URL for the design critic.
// IMPORTANT: only ever pointed at the hidden capture iframe (sandbox="allow-same-origin" with NO
// allow-scripts) — same-origin so we can reach its document for html-to-image, safe because the
// generated app cannot execute code there. The visible preview is an opaque origin and its
// contentDocument is intentionally unreachable. Waits for fonts so the critic judges the real
// type. Never throws.

import { toPng } from "html-to-image";

const MAX_W = 1280;
const MAX_H = 2200;

export async function captureIframe(iframe: HTMLIFrameElement | null): Promise<string | null> {
  if (!iframe) return null;
  const doc = iframe.contentDocument;
  if (!doc) return null;
  const target = (doc.body || doc.documentElement) as HTMLElement;
  if (!target) return null;

  try {
    // Best-effort: let web fonts settle before snapshotting.
    try {
      await (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    } catch {
      /* fonts API not available */
    }

    const width = Math.min(Math.max(target.scrollWidth, iframe.clientWidth || 0, 320), MAX_W);
    const height = Math.min(Math.max(target.scrollHeight, iframe.clientHeight || 0, 240), MAX_H);
    const bg = doc.defaultView?.getComputedStyle(target).backgroundColor || "#ffffff";

    return await toPng(target, { width, height, backgroundColor: bg, pixelRatio: 1, cacheBust: true });
  } catch {
    return null;
  }
}
