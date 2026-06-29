import styles from "./EmptyState.module.css";

// Reusable empty / no-results surface: a soft icon badge, a display title, an optional
// line of body copy, and an optional row of actions. Used for the dashboard's no-results
// and zero-state, and available to any list/grid that can come up empty.
export default function EmptyState({
  icon,
  title,
  body,
  actions,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={styles.empty} role="status">
      {icon && (
        <div className={styles.icon} aria-hidden>
          {icon}
        </div>
      )}
      <div className={styles.title}>{title}</div>
      {body && <p className={styles.body}>{body}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
