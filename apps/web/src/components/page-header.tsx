import { Settings } from "lucide-react";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  description?: string;
  dateLabel?: string;
  showSettings?: boolean;
};

export function PageHeader({
  title,
  description,
  dateLabel,
  showSettings = true,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {dateLabel ? <p className="date-label">{dateLabel}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {showSettings ? (
        <Link
          className="icon-button"
          href="/settings"
          aria-label="打开设置"
          title="设置"
        >
          <Settings aria-hidden="true" size={19} strokeWidth={1.8} />
        </Link>
      ) : null}
    </header>
  );
}
