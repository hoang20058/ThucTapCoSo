import { useRef, useState } from "react";
import PageHeader from "../components/shared/PageHeader";
import { useApp } from "../context/AppContext";
import { assessVaultPasswords } from "../utils/password";
import Modal from "../components/ui/Modal";
import { Download, Upload, Trash2, ShieldAlert } from "lucide-react";

export default function ImportExportPage() {
  const { importVaultData, requestMasterAction, clearAllVaultData, exportVaultData, notify } = useApp();
  const fileRef = useRef(null);

  // Import states
  const [preview, setPreview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [importPassword, setImportPassword] = useState("");
  const [pendingRawText, setPendingRawText] = useState("");
  const [isPromptOpen, setPromptOpen] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [isImporting, setImporting] = useState(false);

  const closePrompt = () => {
    setPromptOpen(false);
    setPendingRawText("");
    setImportPassword("");
    setPromptError("");
  };

  const executeImport = async (password = "") => {
    if (!pendingRawText) {
      setPromptError("Không tìm thấy dữ liệu file import");
      return;
    }

    setImporting(true);
    setPromptError("");

    try {
      const parsed = await importVaultData(pendingRawText, password);
      const assessment = assessVaultPasswords(parsed);
      setPreview(parsed.slice(0, 5));
      setSummary(assessment);
      notify(
        assessment.weakCount > 0
          ? `Đã import ${assessment.total} bản ghi, có ${assessment.weakCount} mật khẩu rủi ro cần đổi.`
          : `Đã import ${assessment.total} bản ghi, tất cả đạt khuyến nghị.`,
        assessment.weakCount > 0 ? "warning" : "success"
      );
      closePrompt();
    } catch (error) {
      const message = error?.message || "File import không hợp lệ";
      setPromptError(message);
      setSummary(null);
      setPreview([{ error: message }]);
      notify(message, "danger");
    } finally {
      setImporting(false);
    }
  };

  const handleImportFileSelection = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPendingRawText(String(reader.result ?? ""));
      setPromptOpen(true);
      setPromptError("");
      setImportPassword("");
    };
    reader.onerror = () => {
      notify("Không thể đọc file import", "danger");
    };
    reader.readAsText(file);
  };

  // Export handler
  const runExport = async (password) => {
    try {
      const payload = await exportVaultData(password);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "vault-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      notify("Đã xuất dữ liệu mật khẩu thành công!", "success");
    } catch (err) {
      notify(err.message || "Xuất dữ liệu thất bại", "danger");
    }
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Công cụ"
        title="Nhập & Xuất dữ liệu"
        description="Quản lý sao lưu dữ liệu két sắt. Nhập dữ liệu từ file JSON hoặc xuất bản sao lưu được mã hóa an toàn."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Import Section */}
        <div className="panel p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-app-text">📥 Nhập dữ liệu</h3>
          </div>

          <div className="flex flex-col gap-4">
            <button
              className="btn-primary w-full h-12 flex items-center justify-center gap-2"
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
              Nhập file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleImportFileSelection(file);
                event.target.value = "";
              }}
            />
          </div>

          {/* Import summary and preview */}
          {summary && (
            <div className="rounded-2xl border border-app-border bg-app-surface-alt/50 p-4 text-sm space-y-1.5">
              <p className="font-semibold text-app-text">Kết quả phân tích file nhập:</p>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 bg-app-surface rounded-xl border border-app-border">
                  <p className="text-xs text-app-muted">Tổng bản ghi</p>
                  <p className="text-base font-bold text-app-text mt-0.5">{summary.total}</p>
                </div>
                <div className="p-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">An toàn</p>
                  <p className="text-base font-bold text-emerald-500 mt-0.5">{summary.safeCount}</p>
                </div>
                <div className="p-2 bg-red-500/5 rounded-xl border border-red-500/10">
                  <p className="text-xs text-red-600 dark:text-red-400">Rủi ro</p>
                  <p className="text-base font-bold text-red-500 mt-0.5">{summary.weakCount}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Export & Clear Section */}
        <div className="space-y-6">
          {/* Export Card */}
          <div className="panel p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-app-text">📤 Xuất dữ liệu</h3>
            </div>

            <button
              className="btn-primary w-full h-12 flex items-center justify-center gap-2"
              type="button"
              onClick={() => requestMasterAction("Xuất dữ liệu", runExport, { forceReauth: true })}
            >
              <Download className="h-5 w-5" />
              Xuất file
            </button>

            <p className="text-xs text-app-muted leading-relaxed">
              * Tệp xuất chứa toàn bộ thông tin đăng nhập được mã hóa an toàn. Bạn có thể khôi phục lại bất kỳ lúc với cùng Master Password hiện tại.
            </p>
          </div>

          {/* Erase Card */}
          <div className="panel p-6 space-y-5 border border-red-500/20 bg-red-500/5">
            <div className="flex gap-3">
              <ShieldAlert className="h-6 w-6 text-red-500 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-red-500 dark:text-red-400">Vùng nguy hiểm</h3>
                <p className="text-xs text-app-muted mt-1 leading-relaxed">
                  Hành động này sẽ xóa sạch toàn bộ dữ liệu đang lưu trữ trong két sắt của bạn trên trình duyệt hiện tại. Bạn nên xuất dữ liệu sao lưu trước khi thực hiện.
                </p>
              </div>
            </div>

            <button
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 text-base font-medium text-red-600 transition hover:bg-red-500/20 active:bg-red-500/30"
              type="button"
              onClick={() => requestMasterAction("Xóa toàn bộ dữ liệu vault", clearAllVaultData, { forceReauth: true })}
            >
              <Trash2 className="h-5 w-5" />
              Xóa toàn bộ dữ liệu cục bộ
            </button>
          </div>
        </div>
      </div>

      {/* Password decryption prompt modal */}
      <Modal open={isPromptOpen} title="Xác nhận nhập dữ liệu" onClose={isImporting ? () => { } : closePrompt}>
        <div className="space-y-4">
          <p className="text-sm text-app-muted">
            Nếu tệp JSON được mã hóa bằng mật khẩu master khác, vui lòng nhập mật khẩu đó bên dưới để giải mã. Nếu đây là tệp JSON(không mã hóa), hãy nhấn <strong>bỏ qua</strong> để nhập trực tiếp.
          </p>
          <input
            className="field"
            type="password"
            placeholder="Nhập Master Password giải mã (nếu có)"
            value={importPassword}
            onChange={(event) => setImportPassword(event.target.value)}
            disabled={isImporting}
          />
          {promptError ? <p className="text-sm font-semibold text-red-500">{promptError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-app-border">
            <button className="btn-soft" type="button" onClick={closePrompt} disabled={isImporting}>
              Hủy bỏ
            </button>
            <button className="btn-soft" type="button" onClick={() => executeImport("")} disabled={isImporting}>
              Bỏ qua
            </button>
            <button
              className="btn-primary"
              type="button"
              onClick={() => executeImport(importPassword)}
              disabled={isImporting}
            >
              {isImporting ? "Đang giải mã..." : "Nhập"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
