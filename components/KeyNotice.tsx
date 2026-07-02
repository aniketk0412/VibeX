import Link from "next/link";
import { IconZap } from "@/components/icons";
import styles from "./KeyNotice.module.css";

// "Connect an AI key" nudge shown on pre-build screens when no model key is available, so users
// know a build will be a real generation (not a simulated placeholder) before they invest time.
export default function KeyNotice({
  message = "No AI model is connected, so builds run as simulated placeholders. Connect a key for real, reviewed, design-checked apps.",
  cta = "Connect a key",
  href = "/settings",
}: {
  message?: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className={styles.notice} role="status">
      <span className={styles.icon} aria-hidden><IconZap size={15} /></span>
      <p className={styles.text}>{message}</p>
      <Link href={href} className={styles.cta}>
        {cta} →
      </Link>
    </div>
  );
}
