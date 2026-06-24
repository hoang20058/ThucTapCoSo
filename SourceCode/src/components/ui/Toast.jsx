import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const tone = {
    success: {
      Icon: CheckCircle2,
      accent: "bg-emerald-500",
      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      title: "Thành công"
    },
    warning: {
      Icon: AlertTriangle,
      accent: "bg-amber-500",
      icon: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      title: "Cần chú ý"
    },
    danger: {
      Icon: XCircle,
      accent: "bg-rose-500",
      icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
      title: "Không thành công"
    },
    info: {
      Icon: Info,
      accent: "bg-app-primary",
      icon: "bg-app-primary/10 text-app-primary",
      title: "Thông báo"
    }
  };

  const currentTone = tone[toast.type] || tone.info;
  const Icon = currentTone.Icon;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[60] w-[min(92vw,30rem)] -translate-x-1/2 animate-toast-in overflow-hidden rounded-2xl border border-app-border bg-app-surface text-app-text shadow-modal"
      role={toast.type === "danger" ? "alert" : "status"}
    >
      <div className={`h-1 w-full ${currentTone.accent}`} />
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${currentTone.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{currentTone.title}</p>
          <p className="mt-0.5 text-sm leading-5 text-app-muted">{toast.message}</p>
        </div>
        {toast.action ? (
          <button
            className="shrink-0 rounded-xl border border-app-border bg-app-surface-alt px-3 py-1.5 text-xs font-semibold text-app-text transition-all duration-200 ease-premium hover:border-app-primary/45 hover:bg-app-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
            type="button"
            onClick={() => {
              toast.action.onClick?.();
              onClose();
            }}
          >
            {toast.action.label || "Hoàn tác"}
          </button>
        ) : (
          <button
            className="icon-button h-9 w-9"
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
