import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import { generatePassword } from "../utils/crypto";

export default function GeneratorPage() {
  const [length, setLength] = useState(20);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState(() => generatePassword());

  const options = useMemo(
    () => ({
      uppercase: includeUppercase,
      numbers: includeNumbers,
      symbols: includeSymbols
    }),
    [includeUppercase, includeNumbers, includeSymbols]
  );

  const regenerate = () => {
    setPassword(generatePassword(length, options));
  };

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Công cụ"
        title="Trình tạo mật khẩu mạnh"
        description="Sinh mật khẩu mạnh theo tiêu chí bảo mật và nhu cầu cá nhân."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-app-surface-alt p-4 font-mono text-lg">
            <span className="break-all">{password}</span>
            <button
              className="btn-soft px-3 py-2"
              type="button"
              onClick={async () => navigator.clipboard.writeText(password)}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Độ dài: {length}
              <input className="mt-2 w-full" type="range" min="8" max="64" value={length} onChange={(event) => setLength(Number(event.target.value))} />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded-2xl border p-3">
                <input type="checkbox" checked={includeUppercase} onChange={(event) => setIncludeUppercase(event.target.checked)} />
                Chữ hoa
              </label>
              <label className="flex items-center gap-2 rounded-2xl border p-3">
                <input type="checkbox" checked={includeNumbers} onChange={(event) => setIncludeNumbers(event.target.checked)} />
                Số
              </label>
              <label className="flex items-center gap-2 rounded-2xl border p-3">
                <input type="checkbox" checked={includeSymbols} onChange={(event) => setIncludeSymbols(event.target.checked)} />
                Ký tự đặc biệt
              </label>
            </div>
            <button className="btn-primary" type="button" onClick={regenerate}>
              Tạo mật khẩu mới
            </button>
          </div>
        </div>
        <div className="panel p-6 text-sm text-app-muted">
          <p className="font-semibold text-app-text">Mẹo bảo mật</p>
          <p className="mt-2">Mật khẩu mạnh nên có độ dài từ 8 ký tự trở lên, kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt.</p>
        </div>
      </div>
    </section>
  );
}
