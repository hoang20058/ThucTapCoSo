import { LoaderCircle } from "lucide-react";

export default function LoadingSpinner({
  label = "Đang xử lý...",
  description = "",
  size = "md",
  className = ""
}) {
  const sizeClass = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8"
  }[size] || "h-5 w-5";

  return (
    <div className={`inline-flex items-center gap-3 text-app-text ${className}`} role="status" aria-live="polite">
      <LoaderCircle className={`${sizeClass} animate-spin text-app-primary`} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description ? <span className="block text-xs text-app-muted">{description}</span> : null}
      </span>
    </div>
  );
}
