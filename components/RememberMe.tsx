"use client";

// "Keep me signed in" toggle. Checked (default) → persistent 30-day session. Unchecked →
// writes a `vibex-remember=0` cookie that middleware uses to downgrade the session cookie to a
// browser-session cookie. Lives client-side so a single control applies to every sign-in method.

import { useEffect, useState } from "react";
import styles from "./RememberMe.module.css";

function writeCookie(remember: boolean) {
  document.cookie = remember
    ? "vibex-remember=; Max-Age=0; Path=/; SameSite=Lax" // clear the opt-out
    : `vibex-remember=0; Max-Age=${60 * 60 * 24 * 400}; Path=/; SameSite=Lax`;
}

export default function RememberMe() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    writeCookie(on);
  }, [on]);

  return (
    <label className={styles.remember}>
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <span>Keep me signed in for 30 days</span>
    </label>
  );
}
