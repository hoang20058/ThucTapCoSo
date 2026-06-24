import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Wallet } from "lucide-react";
import { useApp } from "../context/AppContext";
import { evaluatePasswordStrength, extractUserInputs, containsPersonalInfo } from "../utils/password";
import { getIdentityAddress, vaultService } from "../services/vaultService";
import PasswordStrengthHint from "../components/security/PasswordStrengthHint";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { loginWithGoogleService } from "../services/authService";

export default function AuthPage() {
  const navigate = useNavigate();
  const {
    session,
    connectWallet,
    bootstrapped,
    authBusy,
    setSession,
    setProfile,
    createMasterPassword,
    unlockWithMasterPassword
  } = useApp();
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [tab, setTab] = useState("login");
  const [identity, setIdentity] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [loginMaster, setLoginMaster] = useState("");
  const [registerMaster, setRegisterMaster] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // States for security optimization profile
  const [showSecurityProfile, setShowSecurityProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  const personalInputs = useMemo(() => {
    return extractUserInputs({ fullName, dob, phone });
  }, [fullName, dob, phone]);

  const registerStrength = useMemo(
    () =>
      evaluatePasswordStrength(
        registerMaster,
        [identity?.email || "", identity?.displayName || "", userAddress || ""],
        personalInputs
      ),
    [identity?.displayName, identity?.email, userAddress, registerMaster, personalInputs]
  );

  const applyIdentityToProfile = (selectedIdentity, resolvedAddress) => {
    if (!selectedIdentity) return;
    setProfile((prev) => ({
      ...prev,
      name: selectedIdentity.displayName || prev.name,
      email: selectedIdentity.email || prev.email,
      username: selectedIdentity.email?.split("@")[0] || resolvedAddress?.slice(0, 10) || prev.username
    }));
  };

  const finalizeSession = (selectedIdentity, resolvedAddress) => {
    const isGoogle = selectedIdentity.provider === "google";
    setSession({
      isAuthenticated: true,
      provider: selectedIdentity.provider,
      google: isGoogle ? selectedIdentity : null,
      wallet: isGoogle ? null : selectedIdentity
    });
    applyIdentityToProfile(selectedIdentity, resolvedAddress);
    navigate("/app/vault", { replace: true });
  };

  useEffect(() => {
    if (bootstrapped && session?.isAuthenticated) {
      navigate("/app/vault", { replace: true });
    }
  }, [bootstrapped, navigate, session]);

  const resetFormFlow = (nextTab) => {
    setTab(nextTab);
    setIdentity(null);
    setUserAddress("");
    setIsRegistered(false);
    setResetConfirmed(false);
    setLoginMaster("");
    setRegisterMaster("");
    setRegisterConfirm("");
    setError("");
    setSyncNotice("");
  };

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setError("");
    setSyncNotice("");
    setResetConfirmed(false);
  };

  const checkRegistrationOnChain = async (addr, providerType = "google") => {
    return await vaultService.checkUserRegistration(addr, providerType);
  };

  const handleLoginWithProvider = async (providerType) => {
    setError("");

    // For MetaMask or if Google is already connected, require master password
    const isGoogleConnected = providerType === "google" && identity && identity.provider === "google";
    if ((providerType === "metamask" || isGoogleConnected) && !loginMaster) {
      return setError("Vui lòng nhập master password");
    }

    setIsSyncing(true);
    setSyncNotice(`Đang kết nối danh tính bằng ${providerType === "google" ? "Google" : "MetaMask"}...`);

    try {
      let identityResult = null;
      let addr = "";

      if (providerType === "google") {
        if (isGoogleConnected) {
          identityResult = identity;
          addr = userAddress;
        } else {
          const result = await loginWithGoogleService();
          if (!result.success) {
            setError(result.error);
            return;
          }
          identityResult = {
            provider: "google",
            uid: result.uid,
            displayName: result.email.split("@")[0] || "Google User",
            email: result.email,
            photoURL: "https://placehold.co/96",
            address: result.address,
            privateKey: result.privateKey,
            accessMode: "firebase"
          };
          setIdentity(identityResult);
          addr = result.address;
          setUserAddress(addr);

          setSession((prev) => ({
            ...prev,
            provider: "google",
            google: identityResult
          }));
        }
      } else {
        identityResult = await connectWallet(false);
        setIdentity(identityResult);
        addr = await getIdentityAddress(identityResult);
        setUserAddress(addr);
      }

      setSyncNotice("Đang kiểm tra trạng thái tài khoản từ Web3...");
      const registered = await checkRegistrationOnChain(addr, providerType);
      setIsRegistered(registered);

      if (!registered) {
        setTab("register");
        if (loginMaster) {
          setRegisterMaster(loginMaster);
          setRegisterConfirm(loginMaster);
          setError("Tài khoản chưa có Master Password. Đã tự động chuyển sang tab Đăng ký với mật khẩu bạn nhập.");
        } else {
          setError("Tài khoản chưa được đăng ký. Hãy tạo Master Password mới bên dưới.");
        }
        return;
      }

      if (!loginMaster) {
        setError("Đã kết nối Google. Vui lòng nhập Master Password để mở khóa két sắt.");
        return;
      }

      setSyncNotice("Đang tải dữ liệu từ IPFS & giải mã...");
      const result = await unlockWithMasterPassword(loginMaster, addr, providerType, identityResult?.uid);
      if (!result.ok) {
        setError(result.message || "Master password không chính xác");
        return;
      }

      setSyncNotice("Đăng nhập thành công! Đang chuyển hướng...");
      finalizeSession(identityResult, addr);
    } catch (err) {
      setError(err.message || "Không thể đăng nhập.");
    } finally {
      setIsSyncing(false);
      setSyncNotice("");
    }
  };

  const handleRegisterWithProvider = async (providerType) => {
    setError("");

    const isGoogleConnected = providerType === "google" && identity && identity.provider === "google";

    if (isGoogleConnected || providerType === "metamask") {
      if (!registerMaster) {
        return setError("Vui lòng nhập Master Password mới");
      }
      if (!registerStrength.meetsPolicy) {
        return setError("Master password chưa đủ mạnh. Hãy tăng độ dài và độ phức tạp.");
      }
      if (registerMaster !== registerConfirm) {
        return setError("Xác nhận master password không khớp");
      }
      if (isRegistered && !resetConfirmed) {
        return setError("Tài khoản ví này đã được đăng ký. Vui lòng xác nhận đồng ý xóa dữ liệu cũ để Reset.");
      }
    }

    setIsSyncing(true);
    setSyncNotice(`Đang kết nối danh tính bằng ${providerType === "google" ? "Google" : "MetaMask"}...`);

    try {
      let identityResult = null;
      let addr = "";

      if (providerType === "google") {
        if (isGoogleConnected) {
          identityResult = identity;
          addr = userAddress;
        } else {
          const result = await loginWithGoogleService();
          if (!result.success) {
            setError(result.error);
            return;
          }
          identityResult = {
            provider: "google",
            uid: result.uid,
            displayName: result.email.split("@")[0] || "Google User",
            email: result.email,
            photoURL: "https://placehold.co/96",
            address: result.address,
            privateKey: result.privateKey,
            accessMode: "firebase"
          };
          setIdentity(identityResult);
          addr = result.address;
          setUserAddress(addr);

          setSession((prev) => ({
            ...prev,
            provider: "google",
            google: identityResult
          }));
        }
      } else {
        identityResult = await connectWallet(false);
        setIdentity(identityResult);
        addr = await getIdentityAddress(identityResult);
        setUserAddress(addr);
      }

      setSyncNotice("Đang kiểm tra trạng thái tài khoản từ Web3...");
      const registered = await checkRegistrationOnChain(addr, providerType);
      setIsRegistered(registered);

      if (registered && !resetConfirmed) {
        setError("Tài khoản này đã được đăng ký. Vui lòng kiểm tra và tích vào ô xác nhận 'Tôi đồng ý xóa sạch dữ liệu cũ' bên dưới và click Đăng ký lại để thực hiện Reset.");
        return;
      }

      if (!registerMaster) {
        setError("Đã kết nối Google. Vui lòng nhập Master Password để hoàn tất đăng ký.");
        return;
      }
      if (!registerStrength.meetsPolicy) {
        setError("Master password chưa đủ mạnh. Hãy tăng độ dài và độ phức tạp.");
        return;
      }
      if (registerMaster !== registerConfirm) {
        setError("Xác nhận master password không khớp");
        return;
      }

      setSyncNotice("Đang tạo dữ liệu mới, upload IPFS và ghi pointer lên blockchain...");
      const result = await createMasterPassword(registerMaster, addr, providerType, identityResult?.uid, { fullName, dob, phone });
      if (!result.ok) {
        const errorMsg = result.message?.toLowerCase() || "";
        if (errorMsg.includes("insufficient") || errorMsg.includes("gas")) {
          setError(`Ví ảo Google của bạn không đủ phí gas. Vui lòng gửi Sepolia ETH vào địa chỉ ví này để tiếp tục đăng ký: ${addr}`);
        } else {
          setError(result.message || "Đăng ký thất bại.");
        }
        return;
      }

      setSyncNotice("Đăng ký thành công! Đang chuyển hướng...");
      finalizeSession(identityResult, addr);
    } catch (err) {
      const errorMsg = err.message?.toLowerCase() || "";
      if (errorMsg.includes("insufficient") || errorMsg.includes("gas")) {
        setError(`Ví ảo Google của bạn không đủ phí gas. Vui lòng gửi Sepolia ETH vào địa chỉ ví này để tiếp tục đăng ký: ${userAddress || "ví ảo của bạn"}`);
      } else {
        setError(err.message || "Đăng ký thất bại.");
      }
    } finally {
      setIsSyncing(false);
      setSyncNotice("");
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-app-bg p-4 text-app-text sm:p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-app-border bg-app-surface shadow-modal lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.28),transparent_26rem),linear-gradient(135deg,#020617,#0f172a_48%,#111827)] p-8 text-white lg:p-10">
          <div className="relative z-10 flex min-h-full flex-col justify-between gap-10">
            <div>
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-emerald-950/20">
                <Shield className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Minimin Vault</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight lg:text-5xl">
                Quản lý mật khẩu an toàn và phi tập trung
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                Nhập Master Password sau đó chọn tài khoản Google hoặc ví MetaMask để xác minh danh tính Web3 của bạn.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6 p-6 sm:p-8 lg:p-10">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-app-surface-alt p-1">
            <button
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${tab === "login" ? "bg-app-surface text-app-text shadow-sm" : "text-app-muted hover:text-app-text"
                }`}
              type="button"
              onClick={() => handleTabChange("login")}
              disabled={isSyncing}
            >
              Đăng nhập
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${tab === "register" ? "bg-app-surface text-app-text shadow-sm" : "text-app-muted hover:text-app-text"
                }`}
              type="button"
              onClick={() => handleTabChange("register")}
              disabled={isSyncing}
            >
              Đăng ký
            </button>
          </div>

          {userAddress && (
            <div className="rounded-2xl border border-app-border bg-app-surface-alt p-3 text-xs text-app-text flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="truncate"><span className="font-semibold text-app-muted">Danh tính kết nối:</span> {identity?.email || identity?.address || "Đã kết nối"}</p>
                <p className="font-mono truncate"><span className="font-semibold text-app-muted">Ví Web3:</span> {userAddress}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                onClick={() => {
                  setIdentity(null);
                  setUserAddress("");
                  setIsRegistered(false);
                  setResetConfirmed(false);
                  setError("");
                }}
                disabled={isSyncing}
              >
                Hủy kết nối
              </button>
            </div>
          )}

          {tab === "login" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold block">Master Password</label>
                <input
                  className="field"
                  type="password"
                  placeholder="Nhập master password của bạn"
                  value={loginMaster}
                  disabled={isSyncing}
                  onChange={(event) => setLoginMaster(event.target.value)}
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface p-3 text-left shadow-sm transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-app-primary/40 hover:shadow-card active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:pointer-events-none disabled:opacity-50"
                  type="button"
                  onClick={() => handleLoginWithProvider("google")}
                  disabled={authBusy || isSyncing}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-[#4285f4] shadow-sm">
                      G
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-app-text">Đăng nhập bằng Google</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-app-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-app-primary" />
                </button>

                <button
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-3 text-left shadow-sm transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-orange-400/60 hover:bg-orange-500/15 hover:shadow-card active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:pointer-events-none disabled:opacity-50"
                  type="button"
                  onClick={() => handleLoginWithProvider("metamask")}
                  disabled={authBusy || isSyncing || !loginMaster}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm shadow-orange-900/20">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-app-text">Đăng nhập bằng MetaMask</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-app-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-orange-500" />
                </button>

                {isRegistered && (
                  <div className="text-xs text-app-muted text-center pt-2">
                    Bạn quên mật khẩu master?{" "}
                    <button
                      type="button"
                      className="font-semibold text-app-primary underline hover:text-emerald-500 focus:outline-none"
                      onClick={() => handleTabChange("register")}
                    >
                      Reset tài khoản tại đây
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold block">Tạo Master Password</label>
                <input
                  className="field"
                  type="password"
                  placeholder="Nhập master password mới"
                  value={registerMaster}
                  disabled={isSyncing}
                  onChange={(event) => setRegisterMaster(event.target.value)}
                />
              </div>

              <PasswordStrengthHint
                password={registerMaster}
                userInputs={[
                  identity?.email || "",
                  identity?.displayName || ""
                ]}
                personalInputs={personalInputs}
                policyText="Mật khẩu master phải đạt mức Khá trở lên và tối thiểu 8 ký tự."
              />

              {registerMaster && containsPersonalInfo(registerMaster, personalInputs) && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-600 dark:text-rose-200">
                  Mật khẩu chứa thông tin cá nhân của bạn (Tên/Ngày sinh/SĐT), vui lòng chọn mật khẩu khác!
                </div>
              )}

              {/* Optional Personal Info Section */}
              <div className="rounded-2xl border border-app-border bg-app-surface-alt/40 p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowSecurityProfile(!showSecurityProfile)}
                  className="flex w-full items-center justify-between font-semibold text-sm text-app-text hover:text-app-primary transition-colors focus:outline-none"
                >
                  <span>Thông tin tối ưu hóa bảo mật mật khẩu (Tùy chọn)</span>
                  <span className="text-xs text-app-muted">
                    {showSecurityProfile ? "Thu gọn" : "Mở rộng"}
                  </span>
                </button>

                {showSecurityProfile && (
                  <div className="space-y-3 pt-2 border-t border-app-border/60 transition-all duration-300">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-app-muted block">Họ và tên</label>
                      <input
                        className="field text-sm"
                        type="text"
                        placeholder="Nhập họ và tên của bạn"
                        value={fullName}
                        disabled={isSyncing}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-app-muted block">Ngày tháng năm sinh</label>
                      <input
                        className="field text-sm"
                        type="date"
                        value={dob}
                        disabled={isSyncing}
                        onChange={(e) => setDob(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-app-muted block">Số điện thoại</label>
                      <input
                        className="field text-sm"
                        type="tel"
                        placeholder="Nhập số điện thoại"
                        value={phone}
                        disabled={isSyncing}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold block">Xác nhận Master Password</label>
                <input
                  className="field"
                  type="password"
                  placeholder="Nhập lại mật khẩu để xác nhận"
                  value={registerConfirm}
                  disabled={isSyncing}
                  onChange={(event) => setRegisterConfirm(event.target.value)}
                />
              </div>

              {isRegistered && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-200 space-y-2">
                  <p className="font-semibold">Cảnh báo: Tài khoản ví này đã từng được đăng ký</p>
                  <p className="leading-5">
                    Nếu tiếp tục, toàn bộ mật khẩu cũ đã lưu trên Web3 sẽ bị xóa vĩnh viễn và không thể khôi phục.
                  </p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      checked={resetConfirmed}
                      onChange={(e) => setResetConfirmed(e.target.checked)}
                      disabled={isSyncing}
                    />
                    <span>Tôi đồng ý xóa sạch dữ liệu cũ để đặt lại Master Password mới.</span>
                  </label>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface p-3 text-left shadow-sm transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-app-primary/40 hover:shadow-card active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:pointer-events-none disabled:opacity-50"
                  type="button"
                  onClick={() => handleRegisterWithProvider("google")}
                  disabled={authBusy || isSyncing}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-[#4285f4] shadow-sm">
                      G
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-app-text">
                        {isRegistered ? "Reset và Đăng ký bằng Google" : "Đăng ký bằng Google"}
                      </span>
                      <span className="block truncate text-xs text-app-muted">
                        {isRegistered ? "Ghi đè dữ liệu cũ bằng mật khẩu mới" : "Tạo ví ảo và lưu trữ lên Web3"}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-app-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-app-primary" />
                </button>

                <button
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-3 text-left shadow-sm transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-orange-400/60 hover:bg-orange-500/15 hover:shadow-card active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:pointer-events-none disabled:opacity-50"
                  type="button"
                  onClick={() => handleRegisterWithProvider("metamask")}
                  disabled={authBusy || isSyncing || !registerStrength.meetsPolicy || registerMaster !== registerConfirm || (isRegistered && !resetConfirmed)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm shadow-orange-900/20">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-app-text">
                        {isRegistered ? "Reset và Đăng ký bằng MetaMask" : "Đăng ký bằng MetaMask"}
                      </span>
                      <span className="block truncate text-xs text-app-muted">
                        {isRegistered ? "Ghi đè dữ liệu cũ bằng mật khẩu mới" : "Kết nối ví và lưu trữ lên Web3"}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-app-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-orange-500" />
                </button>
              </div>
            </div>
          )}

          {isSyncing && syncNotice && (
            <div className="rounded-2xl border border-app-border bg-app-surface-alt p-3">
              <LoadingSpinner label="Đang đồng bộ..." description={syncNotice} />
            </div>
          )}

          {error ? <div className="panel border-rose-400/40 p-4 text-sm text-rose-600 dark:text-rose-300 break-all">{error}</div> : null}
        </section>
      </div>
    </main>
  );
}
