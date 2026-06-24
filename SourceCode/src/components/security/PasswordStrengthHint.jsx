import { useMemo } from "react";
import { evaluatePasswordStrength } from "../../utils/password";

const meterTone = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-emerald-400"
];

const statusTone = [
  "text-rose-600 dark:text-rose-300",
  "text-orange-600 dark:text-orange-300",
  "text-amber-700 dark:text-amber-300",
  "text-emerald-600 dark:text-emerald-300",
  "text-emerald-600 dark:text-emerald-300"
];

export default function PasswordStrengthHint({ password = "", userInputs = [], policyText }) {
  const strength = useMemo(
    () => evaluatePasswordStrength(password, userInputs),
    [password, userInputs]
  );

  if (!password) {
    return (
      <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-alt/70 p-4 text-sm text-app-muted">
        Đánh giá độ mạnh và thời gian bẻ khóa ước tính.
      </div>
    );
  }

  const score = Math.min(Math.max(strength.score, 0), 4);
  const progress = `${Math.max(12, (score + 1) * 20)}%`;
  const statusLabel = strength.meetsPolicy ? "Đạt chuẩn vault" : "Cần cải thiện";

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface-alt/70 p-4 text-sm shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-muted">Password strength</p>
          <p className="mt-1 text-base font-semibold text-app-text">{strength.label}</p>
        </div>
        <p className={`rounded-full bg-app-surface px-3 py-1 text-xs font-semibold ${statusTone[score]}`}>
          {statusLabel}
        </p>
      </div>

      <div
        aria-label="Password strength score"
        aria-valuemax={5}
        aria-valuemin={1}
        aria-valuenow={score + 1}
        className="h-2.5 overflow-hidden rounded-full bg-app-surface-muted"
        role="meter"
      >
        <div
          className={`h-full rounded-full ${meterTone[score]} transition-all duration-500 ease-premium`}
          style={{ width: progress }}
        />
      </div>

      <div className="mt-3 grid gap-2 text-xs leading-5 text-app-muted">
        <p>Chính sách: {policyText || "Tối thiểu 8 ký tự và đạt mức Khá trở lên."}</p>
        {strength.warning ? <p className="text-amber-700 dark:text-amber-300">Cảnh báo: {strength.warning}</p> : null}
        {strength.suggestions?.length ? <p>Gợi ý: {strength.suggestions[0]}</p> : null}
        {strength.crackTimeDisplay ? (
          <p className="font-mono text-[0.72rem] text-app-text/80">
            Ước tính bẻ khóa: {strength.crackTimeDisplay}
          </p>
        ) : null}
      </div>
    </div>
  );
}
