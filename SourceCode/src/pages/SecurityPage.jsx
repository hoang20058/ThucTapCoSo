import { useMemo, useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/shared/PageHeader";
import PasswordStrengthHint from "../components/security/PasswordStrengthHint";
import { evaluatePasswordStrength, extractUserInputs } from "../utils/password";
import { Shield, User, Lock, Clock, Copy, Check } from "lucide-react";
import { getIdentityAddress } from "../services/vaultService";

export default function SecurityPage() {
  const {
    updateMasterPassword,
    autoLockMinutes,
    setAutoLockMinutes,
    userProfile,
    setUserProfile,
    vaults,
    setVaults,
    notify,
    session
  } = useApp();

  const [activeTab, setActiveTab] = useState("security");
  const [masterForm, setMasterForm] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState("");

  const [walletAddress, setWalletAddress] = useState("");
  const [copied, setCopied] = useState(false);

  // secure profile inputs (stored end-to-end encrypted in the vault)
  const [secProfile, setSecProfile] = useState({
    fullName: userProfile?.fullName || "",
    dob: userProfile?.dob || "",
    phone: userProfile?.phone || ""
  });

  useEffect(() => {
    const fetchAddress = async () => {
      const activeIdentity = session?.wallet || session?.google;
      if (activeIdentity) {
        try {
          const addr = await getIdentityAddress(activeIdentity);
          setWalletAddress(addr || "");
        } catch (e) {
          console.error("Failed to get address:", e);
        }
      } else {
        setWalletAddress("");
      }
    };
    fetchAddress();
  }, [session]);

  useEffect(() => {
    if (userProfile) {
      setSecProfile({
        fullName: userProfile.fullName || "",
        dob: userProfile.dob || "",
        phone: userProfile.phone || ""
      });
    }
  }, [userProfile]);

  const personalInputs = useMemo(
    () => extractUserInputs(userProfile),
    [userProfile]
  );

  const masterStrength = useMemo(
    () => evaluatePasswordStrength(masterForm.next, [], personalInputs),
    [masterForm.next, personalInputs]
  );

  const submitMaster = async (event) => {
    event.preventDefault();
    if (!masterStrength.meetsPolicy) return setMessage("Master password mới chưa đủ mạnh");
    if (masterForm.next !== masterForm.confirm) return setMessage("Xác nhận master password không khớp");

    setMessage("Đang cập nhật master password...");
    const result = await updateMasterPassword(masterForm.current, masterForm.next);
    setMessage(result.ok ? "Đã đổi master password thành công!" : result.message);
    if (result.ok) {
      setMasterForm({ current: "", next: "", confirm: "" });
    }
  };

  const handleSaveSecProfile = async (e) => {
    e.preventDefault();
    try {
      setUserProfile(secProfile);
      // Save directly to the blockchain/IPFS by updating the vault package
      await setVaults(vaults, { userProfile: secProfile });
      notify("Đã đồng bộ thông tin tối ưu hóa bảo mật lên Web3!", "success");
    } catch (err) {
      notify("Đồng bộ thất bại: " + err.message, "danger");
    }
  };

  const truncateAddress = (addr) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      notify("Đã sao chép địa chỉ ví Web3", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Không thể sao chép địa chỉ ví", "danger");
    }
  };

  return (
    <section className="space-y-6 max-w-6xl mx-auto px-4 py-2">
      <PageHeader
        eyebrow="Cài đặt"
        title="Tài khoản & Bảo mật"
        description="Quản lý hồ sơ cá nhân, cấu hình thời gian khóa phiên và đổi Master Password bảo vệ két sắt."
      />

      {/* Tabs Switcher */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all duration-200 focus:outline-none ${activeTab === "security"
              ? "border-app-primary text-app-primary"
              : "border-transparent text-app-muted hover:text-app-text"
            }`}
          type="button"
        >
          <Lock className="h-4 w-4" />
          Cấu hình bảo mật
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all duration-200 focus:outline-none ${activeTab === "profile"
              ? "border-app-primary text-app-primary"
              : "border-transparent text-app-muted hover:text-app-text"
            }`}
          type="button"
        >
          <User className="h-4 w-4" />
          Hồ sơ cá nhân
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {message}
        </div>
      )}

      {activeTab === "security" ? (
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
          {/* Left Panel: Auto Lock settings */}
          <div className="panel p-6 space-y-4 h-fit">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
                <Clock className="h-4 w-4 text-app-primary" />
                Tự động khóa phiên
              </h3>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-app-muted uppercase tracking-wider block" htmlFor="auto-lock-minutes">
                Thời gian chờ trước khi khóa
              </label>
              <select
                id="auto-lock-minutes"
                className="field"
                value={String(autoLockMinutes)}
                onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
              >
                <option value="5">5 phút</option>
                <option value="15">15 phút</option>
                <option value="30">30 phút</option>
                <option value="60">1 giờ</option>
              </select>
            </div>
          </div>

          {/* Right Panel: Change master password */}
          <form className="panel p-6 space-y-4" onSubmit={submitMaster}>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
                <Shield className="h-4 w-4 text-app-primary" />
                Đổi Master Password
              </h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Mật khẩu hiện tại</span>
                <input
                  className="field"
                  type="password"
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                  value={masterForm.current}
                  onChange={(event) => setMasterForm((prev) => ({ ...prev, current: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Mật khẩu mới</span>
                <input
                  className="field"
                  type="password"
                  placeholder="Nhập mật khẩu mới"
                  required
                  value={masterForm.next}
                  onChange={(event) => setMasterForm((prev) => ({ ...prev, next: event.target.value }))}
                />
              </div>

              <PasswordStrengthHint
                password={masterForm.next}
                userInputs={personalInputs}
                policyText="Master password mới của bạn nên đạt mức Khá trở lên và tối thiểu 8 ký tự."
              />

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Xác nhận mật khẩu mới</span>
                <input
                  className="field"
                  type="password"
                  placeholder="Xác nhận lại mật khẩu mới"
                  required
                  value={masterForm.confirm}
                  onChange={(event) => setMasterForm((prev) => ({ ...prev, confirm: event.target.value }))}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                className="btn-primary w-full shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={!masterStrength.meetsPolicy}
              >
                Đổi Master Password
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Identity Overview Section */}
          <div className="panel p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
                  <User className="h-4 w-4 text-app-primary" />
                  Định danh & Kết nối Web3
                </h3>
                <p className="text-xs text-app-muted leading-normal">
                  Thông tin tài khoản liên kết và địa chỉ ví định danh Web3 của bạn.
                </p>
              </div>

              {session?.provider === "google" && session?.google ? (
                <div className="space-y-3 bg-app-surface-alt/50 border border-app-border/60 rounded-2xl p-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-app-muted uppercase tracking-wider block">Hình thức định danh</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      Google Account
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-app-muted uppercase tracking-wider block">Tên tài khoản</span>
                    <p className="text-sm font-semibold text-app-text">{session.google.displayName || "Google User"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-app-muted uppercase tracking-wider block">Email liên kết</span>
                    <p className="text-xs font-semibold text-app-muted">{session.google.email}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-app-surface-alt/50 border border-app-border/60 rounded-2xl p-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-app-muted uppercase tracking-wider block">Hình thức định danh</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/5 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                      Web3 Wallet
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-app-muted uppercase tracking-wider block">Ví kết nối</span>
                    <p className="text-sm font-semibold text-app-text capitalize">{session?.provider || "MetaMask"}</p>
                  </div>
                </div>
              )}

              {walletAddress && (
                <div className="space-y-2 pt-3 border-t border-app-border/50">
                  <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Địa chỉ ví Web3</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm bg-app-surface-alt px-3.5 py-2.5 rounded-xl border border-app-border text-app-text select-all tracking-wider">
                      {truncateAddress(walletAddress)}
                    </span>
                    <button
                      onClick={handleCopyAddress}
                      className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-app-surface-alt border border-app-border hover:bg-app-surface text-app-muted hover:text-app-text transition-all active:scale-95"
                      type="button"
                      title="Sao chép địa chỉ ví Web3"
                    >
                      {copied ? <Check className="h-4 w-4 text-app-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secure Profile Section (Saved E2E encrypted in DApp vault) */}
          <form className="panel p-6 space-y-4 flex flex-col justify-between" onSubmit={handleSaveSecProfile}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
                  <Shield className="h-4 w-4 text-app-primary" />
                  Hồ sơ cá nhân
                </h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Họ và tên</span>
                  <input
                    className="field"
                    value={secProfile.fullName}
                    onChange={(e) => setSecProfile((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Nhập họ và tên"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Ngày tháng năm sinh</span>
                  <input
                    className="field text-app-text"
                    type="date"
                    value={secProfile.dob}
                    onChange={(e) => setSecProfile((prev) => ({ ...prev, dob: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-app-muted uppercase tracking-wider block">Số điện thoại</span>
                  <input
                    className="field"
                    value={secProfile.phone}
                    onChange={(e) => setSecProfile((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Nhập số điện thoại cá nhân"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                className="btn-primary w-full shadow-glow"
                type="submit"
              >
                Cập nhật hồ sơ
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
