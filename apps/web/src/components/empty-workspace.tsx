import type { LucideIcon } from "lucide-react";

type EmptyWorkspaceProps = {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel: string;
};

export function EmptyWorkspace({
  icon: Icon,
  title,
  message,
  actionLabel,
}: EmptyWorkspaceProps) {
  return (
    <section className="empty-workspace" aria-labelledby="empty-title">
      <Icon className="empty-icon" aria-hidden="true" size={28} strokeWidth={1.6} />
      <h2 id="empty-title">{title}</h2>
      <p>{message}</p>
      <button className="primary-button" type="button" disabled>
        {actionLabel}
      </button>
    </section>
  );
}
