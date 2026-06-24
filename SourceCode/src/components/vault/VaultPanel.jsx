import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import Modal from "../ui/Modal";
import LoadingSpinner from "../ui/LoadingSpinner";
import PasswordStrengthHint from "../security/PasswordStrengthHint";
import { getUserFriendlyMessage, normalizeError, ErrorCodes } from "../../utils/errorHandling";
import { evaluatePasswordStrength, getDomainName, isSafePassword, extractUserInputs } from "../../utils/password";
import { useApp } from "../../context/AppContext";

const emptyForm = { url: "", username: "", password: "" };

function InfoTooltip({ content }) {
  return (
    <div className="relative group inline-block ml-1.5 cursor-help">
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-app-border bg-app-surface-alt text-[10px] font-semibold text-app-muted hover:text-app-text transition-colors">
        ?
      </span>
      <div className="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 scale-95 rounded-xl bg-app-surface border border-app-border p-2.5 text-xs text-app-text shadow-modal opacity-0 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200">
        <span className="block text-left font-sans font-normal leading-normal">{content}</span>
        <div className="absolute top-full left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-0.5 rotate-45 bg-app-surface border-r border-b border-app-border" />
      </div>
    </div>
  );
}

function VaultSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div className="rounded-2xl border border-app-border bg-app-surface p-4" key={item}>
          <div className="flex items-center gap-3">
            <div className="skeleton h-11 w-11" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-64 max-w-full" />
            </div>
            <div className="hidden gap-2 sm:flex">
              <div className="skeleton h-10 w-10" />
              <div className="skeleton h-10 w-10" />
              <div className="skeleton h-10 w-10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VaultPanel({ vaults, setVaults, search = "", onToast }) {
  const { encryptionKey, userProfile } = useApp();
  
  const personalInputs = useMemo(() => {
    return extractUserInputs(userProfile);
  }, [userProfile]);

  const vaultList = Array.isArray(vaults) ? vaults : [];
  const isLoading = !Array.isArray(vaults);
  const [mode, setMode] = useState("all");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("Đang lưu...");
  const [saveSeconds, setSaveSeconds] = useState(0);

  useEffect(() => {
    if (!isSaving) {
      setSaveSeconds(0);
      return undefined;
    }

    const timer = window.setInterval(() => setSaveSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isSaving]);

  const stats = {
    total: vaultList.length,
    safe: vaultList.filter((item) => isSafePassword(item.password, [item.url, item.username], personalInputs)).length,
    risk: vaultList.filter((item) => !isSafePassword(item.password, [item.url, item.username], personalInputs)).length
  };

  const filtered = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();
    return vaultList
      .map((item, index) => ({ ...item, index }))
      .filter((item) => {
        const matchMode =
          mode === "all"
            ? true
            : mode === "safe"
              ? isSafePassword(item.password, [item.url, item.username], personalInputs)
              : !isSafePassword(item.password, [item.url, item.username], personalInputs);

        const matchSearch =
          !searchTerm ||
          item.url.toLowerCase().includes(searchTerm) ||
          item.username.toLowerCase().includes(searchTerm);

        return matchMode && matchSearch;
      });
  }, [mode, search, vaultList, personalInputs]);

  const openCreate = () => {
    if (isSaving) return;
    setEditingIndex(null);
    setForm(emptyForm);
    setShowFormPassword(false);
    setSaveMessage("Đang lưu...");
    setModalOpen(true);
  };

  const openEdit = (index) => {
    if (isSaving) return;
    setEditingIndex(index);
    setForm(vaultList[index]);
    setShowFormPassword(false);
    setSaveMessage("Đang lưu...");
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();

    if (!form.url || !form.username || !form.password) {
      onToast("Vui lòng nhập đầy đủ URL, username và password.", "danger");
      return;
    }

    const updatedVaults = editingIndex === null
      ? [...vaultList, form]
      : vaultList.map((item, index) => (index === editingIndex ? form : item));

    setIsSaving(true);
    setSaveMessage("Đang mã hóa vault...");
    onToast("Đang mã hóa và đẩy lên Web3...", "info", { duration: 15000 });

    try {
      await setVaults(updatedVaults, {
        onProgress: ({ message }) => {
          if (message) setSaveMessage(message);
        }
      });

      onToast("Đã lưu an toàn lên Blockchain!", "success");
      setModalOpen(false);
      setForm(emptyForm);
      setEditingIndex(null);
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.code === ErrorCodes.USER_REJECTED) {
        onToast("Giao dịch bị hủy", "danger");
      } else {
        onToast(getUserFriendlyMessage(error), "danger", { duration: 8000 });
      }
    } finally {
      setIsSaving(false);
      setSaveMessage("Đang lưu...");
    }
  };

  const remove = async (index) => {
    if (isSaving) return;

    const updatedVaults = vaultList.filter((_, idx) => idx !== index);

    setIsSaving(true);
    onToast("Đang mã hóa và đẩy lên Web3...", "info", { duration: 15000 });

    try {
      await setVaults(updatedVaults);
      onToast("Đã lưu an toàn lên Blockchain!", "success");
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.code === ErrorCodes.USER_REJECTED) {
        onToast("Giao dịch bị hủy", "danger");
      } else {
        onToast(getUserFriendlyMessage(error), "danger", { duration: 8000 });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const copyPassword = async (password) => {
    try {
      await navigator.clipboard.writeText(password);
      onToast("Đã sao chép mật khẩu", "info");
    } catch {
      onToast("Không thể sao chép mật khẩu. Hãy thử lại.", "danger");
    }
  };

  const statCards = [
    { id: "all", label: "Tổng số", value: stats.total, Icon: KeyRound, tone: "text-app-primary", helper: "Mục đang lưu" },
    { id: "safe", label: "An toàn", value: stats.safe, Icon: ShieldCheck, tone: "text-app-success", helper: "Đạt chính sách" },
    { id: "risk", label: "Rủi ro", value: stats.risk, Icon: ShieldAlert, tone: "text-app-danger", helper: "Cần xử lý" }
  ];

  const hasSearch = search.trim().length > 0;
  const isInitialEmpty = vaultList.length === 0;

  const tooltipContent = {
    all: "Tổng số tài khoản và mật khẩu đã được lưu trữ mã hóa trong kho dữ liệu của bạn.",
    safe: "Mật khẩu đạt tiêu chuẩn (tối thiểu 8 ký tự, độ phức tạp Khá/Mạnh và không trùng thông tin cá nhân).",
    risk: "Mật khẩu có độ bảo mật thấp, quá ngắn hoặc dễ đoán (chứa họ tên, ngày sinh, số điện thoại)."
  };

  return (
    <section className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-app-primary">Vault Overview</p>
          <h2 className="mt-1 text-2xl font-black text-app-text tracking-tight">Két Sắt Cá Nhân</h2>
        </div>
        <button 
          className="btn-primary min-h-[2.75rem] px-5 flex items-center gap-2"
          onClick={openCreate} 
          type="button" 
          disabled={isSaving}
        >
          <Plus className="h-4.5 w-4.5" />
          {isSaving ? `Đang đồng bộ... (${saveSeconds}s)` : "Thêm mật khẩu"}
        </button>
      </div>

      {/* Filter / Stat Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map(({ id, label, value, Icon, helper }) => {
          const active = mode === id;

          return (
            <button
              className={`group flex items-center justify-between p-5 text-left border rounded-2xl transition-all duration-200 focus:outline-none ${
                active 
                  ? "border-app-primary/60 bg-app-surface shadow-md shadow-app-primary/5" 
                  : "border-app-border bg-app-surface-alt/40 hover:bg-app-surface hover:border-app-border/80"
              }`}
              key={id}
              onClick={() => setMode(id)}
              type="button"
              disabled={isSaving}
            >
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-app-muted flex items-center gap-1.5">
                  <span>{label}</span>
                  <InfoTooltip content={tooltipContent[id]} />
                </div>
                <p className={`text-3xl font-black tracking-tight ${
                  id === "all" ? "text-app-text" : id === "safe" ? "text-app-success" : "text-app-danger"
                }`}>{value}</p>
                <p className="text-xs text-app-muted/80 font-medium">{helper}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-app-surface-alt border border-app-border ${
                id === "all" ? "text-app-muted" : id === "safe" ? "text-app-success" : "text-app-danger"
              }`}>
                <Icon className="h-5.5 w-5.5 transition-transform duration-300 group-hover:scale-110" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Vault Panel Container */}
      <div className="border border-app-border bg-app-surface/40 rounded-3xl p-4 lg:p-6 shadow-card backdrop-blur-sm">
        {isLoading ? <VaultSkeleton /> : null}

        {/* Empty States */}
        {!isLoading && filtered.length === 0 ? (
          <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-app-border bg-app-surface-alt/25 p-8 text-center max-w-md mx-auto my-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-surface border border-app-border text-app-muted shadow-md mb-4">
              {isInitialEmpty ? <LockKeyhole className="h-7 w-7 text-app-primary" /> : <SearchX className="h-7 w-7" />}
            </div>
            <h3 className="text-base font-bold text-app-text">
              {isInitialEmpty ? "Két sắt của bạn trống" : "Không tìm thấy kết quả"}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-app-muted max-w-sm">
              {isInitialEmpty
                ? "Lưu trữ thông tin tài khoản và mật khẩu đầu tiên của bạn lên hệ thống Web3 bảo mật."
                : hasSearch
                  ? "Hãy thử thay đổi từ khóa tìm kiếm hoặc kiểm tra lại các bộ lọc."
                  : "Không tìm thấy mật khẩu nào ở bộ lọc này. Hãy thử đặt lại bộ lọc."}
            </p>
            <button 
              className="btn-soft min-h-[2.5rem] px-5 mt-5" 
              type="button" 
              onClick={isInitialEmpty ? openCreate : () => setMode("all")}
            >
              {isInitialEmpty ? "Thêm tài khoản" : "Xem tất cả mật khẩu"}
            </button>
          </div>
        ) : null}

        {/* Vault Items List */}
        {!isLoading && filtered.length > 0 ? (
          <div className="grid gap-4">
            {filtered.map((item) => {
              const strength = evaluatePasswordStrength(item.password, [item.url, item.username], personalInputs);
              const safe = strength.meetsPolicy;
              const domain = getDomainName(item.url) || "unknown-site";

              return (
                <article
                  className="group rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm hover:border-app-primary/45 hover:bg-app-surface-alt transition-all duration-300"
                  key={`${item.url}-${item.index}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      {/* Domain Icon Box */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-surface-alt border border-app-border text-app-primary">
                        <Globe2 className="h-5 w-5" />
                      </div>
                      
                      {/* Domain and Info Box */}
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="truncate text-base font-extrabold text-app-text tracking-tight leading-tight">{domain}</h3>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              safe
                                ? "bg-app-success/5 border border-app-success/20 text-app-success"
                                : "bg-app-danger/5 border border-app-danger/20 text-app-danger"
                            }`}
                          >
                            {safe ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                            {safe ? "An toàn" : "Rủi ro"}
                          </span>
                        </div>

                        {/* Details row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-app-muted font-medium">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5 shrink-0 text-app-muted" />
                            <span className="truncate">{item.username}</span>
                          </span>
                          <span className="font-mono text-xs tracking-[0.2em] text-app-muted/50">••••••••••••</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-app-surface-alt border border-app-border ${
                            safe ? "text-app-success" : "text-app-warning"
                          }`}>
                            {strength.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons controls */}
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-app-border bg-app-surface-alt text-app-muted hover:text-app-text hover:bg-app-surface hover:border-app-primary/45 active:scale-95 transition-all duration-200" 
                        type="button" 
                        onClick={() => copyPassword(item.password)} 
                        aria-label={`Sao chép mật khẩu cho ${domain}`} 
                        disabled={isSaving}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button 
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-app-border bg-app-surface-alt text-app-muted hover:text-app-text hover:bg-app-surface hover:border-app-primary/45 active:scale-95 transition-all duration-200" 
                        type="button" 
                        onClick={() => openEdit(item.index)} 
                        aria-label={`Chỉnh sửa ${domain}`} 
                        disabled={isSaving}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-app-border bg-app-surface-alt text-app-danger hover:bg-app-danger/10 hover:border-app-danger/25 active:scale-95 transition-all duration-200"
                        type="button"
                        onClick={() => remove(item.index)}
                        aria-label={`Xóa ${domain}`}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Add / Edit password popup Modal */}
      <Modal
        open={isModalOpen}
        title={editingIndex === null ? "Thêm mật khẩu mới" : "Chỉnh sửa tài khoản"}
        onClose={() => {
          if (isSaving) return;
          setModalOpen(false);
          setShowFormPassword(false);
        }}
      >
        <form className="relative space-y-4" onSubmit={save}>
          {isSaving ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-app-bg/95 p-6 backdrop-blur-sm">
              <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-panel">
                <LoadingSpinner
                  size="lg"
                  label={`Đang lưu... (${saveSeconds}s)`}
                  description={saveMessage || "Đang chờ xác nhận và đồng bộ dữ liệu."}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Website URL</span>
            <input
              className="field"
              placeholder="https://example.com"
              required
              value={form.url}
              disabled={isSaving}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Username hoặc Email</span>
            <input
              className="field"
              placeholder="name@example.com"
              required
              value={form.username}
              disabled={isSaving}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Mật khẩu</span>
            <div className="relative">
              <input
                className="field pr-12 font-mono"
                type={showFormPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                required
                value={form.password}
                disabled={isSaving}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              <button
                className="icon-button absolute inset-y-0 right-2 my-auto h-8 w-8 rounded-lg border-none bg-transparent hover:bg-app-surface-alt text-app-muted hover:text-app-text"
                type="button"
                onClick={() => setShowFormPassword((prev) => !prev)}
                aria-label={showFormPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                disabled={isSaving}
              >
                {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <PasswordStrengthHint
            password={form.password}
            userInputs={[form.url, form.username]}
            personalInputs={personalInputs}
            policyText="Mật khẩu lưu trong két sắt nên đạt mức Khá trở lên và tối thiểu 8 ký tự."
          />
          
          <div className="pt-2">
            <button
              className="btn-primary w-full"
              type="submit"
              disabled={isSaving}
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
