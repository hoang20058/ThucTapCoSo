import { useId } from "react";
import { X } from "lucide-react";

export default function Modal({ open, title, onClose, children }) {
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <section
        aria-labelledby={title ? titleId : undefined}
        aria-modal="true"
        className="panel-elevated w-full max-w-xl animate-modal-in overflow-hidden"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4 border-b border-app-border bg-app-surface-alt/70 px-5 py-4">
          <div>
            {title ? (
              <h3 className="text-base font-semibold leading-6 text-app-text" id={titleId}>
                {title}
              </h3>
            ) : null}
            <p className="mt-0.5 text-xs text-app-muted">Encrypted vault action</p>
          </div>
          <button className="icon-button h-9 w-9" onClick={onClose} type="button" aria-label="Đóng modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
