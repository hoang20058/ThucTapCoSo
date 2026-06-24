import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { CryptoOperationError } from "../utils/crypto";
import { signInWithGoogle, signOutGoogle, restoreGooglePrivateKey } from "../services/authService";
import { connectMetaMask } from "../services/walletService";
import { vaultService, getIdentityAddress } from "../services/vaultService";
import { getUserFriendlyMessage, ErrorCodes } from "../utils/errorHandling";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"];

const defaultProfile = {
  name: "miniminZ",
  username: "miniminz",
  email: "",
  bio: "Công nghệ thông tin | PTIT"
};

const defaultSession = {
  isAuthenticated: false,
  provider: null,
  google: null,
  wallet: null
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useLocalStorage(STORAGE_KEYS.SESSION, defaultSession);
  const [vaults, setVaultsState] = useState([]);
  const [userProfile, setUserProfileState] = useState({ fullName: "", dob: "", phone: "" });
  const [profile, setProfile] = useLocalStorage(STORAGE_KEYS.USER_PROFILE, defaultProfile);
  const [theme, setTheme] = useLocalStorage(STORAGE_KEYS.THEME, "dark");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [masterGate, setMasterGate] = useState({ open: false, purpose: "", action: null });
  const [authBusy, setAuthBusy] = useState(false);
  const [hasVaultData, setHasVaultData] = useState(false);
  const [hasMasterPassword, setHasMasterPassword] = useState(false);
  const [search, setSearch] = useLocalStorage("appSearch", "");
  const [autoLockMinutes, setAutoLockMinutes] = useLocalStorage(STORAGE_KEYS.AUTO_LOCK_MINUTES, 15);
  const [isSessionUnlocked, setSessionUnlocked] = useLocalStorage(STORAGE_KEYS.SESSION_UNLOCKED, false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const vaultsRef = useRef([]);
  const userProfileRef = useRef({ fullName: "", dob: "", phone: "" });
  const sessionKeyRef = useRef(null);

  useEffect(() => {
    vaultsRef.current = vaults;
  }, [vaults]);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  }, []);

  useEffect(() => {
    const bootstrapSecrets = async () => {
      // Keep Google/MetaMask session across page refresh, but lock it (isSessionUnlocked = false)
      // since the RAM encryption key is lost.
      setSessionUnlocked(false);
      setVaultsState([]);
      sessionKeyRef.current = null;
      setHasVaultData(false);
      setHasMasterPassword(false);
      setBootstrapped(true);
    };

    bootstrapSecrets();
  }, [setSessionUnlocked]);

  useEffect(() => {
    if (session?.isAuthenticated && session?.provider === "google" && session?.google?.uid) {
      restoreGooglePrivateKey(session.google.uid, session.google.email);
    }
  }, [session]);

  useEffect(() => {
    const clearSessionKey = () => {
      sessionKeyRef.current = null;
    };

    window.addEventListener("pagehide", clearSessionKey);
    window.addEventListener("beforeunload", clearSessionKey);

    return () => {
      window.removeEventListener("pagehide", clearSessionKey);
      window.removeEventListener("beforeunload", clearSessionKey);
    };
  }, []);

  const setVaults = useCallback(async (nextVaultsOrUpdater, options = {}) => {
    const encryptionKey = sessionKeyRef.current;
    if (!encryptionKey) {
      throw new Error("Phiên đang khóa. Vui lòng mở khóa trước khi thay đổi vault.");
    }

    const activeIdentity = session?.wallet || session?.google;
    const userAddress = await getIdentityAddress(activeIdentity);
    if (!userAddress) {
      throw new Error("Không tìm thấy thông tin định danh người dùng.");
    }

    const previousVaults = vaultsRef.current;
    const computedVaults = typeof nextVaultsOrUpdater === "function"
      ? nextVaultsOrUpdater(previousVaults)
      : nextVaultsOrUpdater;
    const normalizedVaults = Array.isArray(computedVaults) ? computedVaults : [];

    setVaultsState(normalizedVaults);

    try {
      const saveResult = await vaultService.saveVaultsWithKey(
        normalizedVaults,
        encryptionKey,
        userAddress,
        { ...options, providerType: session?.provider, uid: session?.google?.uid, userProfile: userProfileRef.current }
      );
      setHasVaultData(normalizedVaults.length > 0 || (await vaultService.hasVaultData(userAddress)));
      return { vaults: normalizedVaults, sync: saveResult?.sync || { status: "unknown" } };
    } catch (error) {
      setVaultsState(previousVaults);
      try {
        await vaultService.saveVaultsWithKey(previousVaults, encryptionKey, userAddress, { skipWeb3: true, userProfile: userProfileRef.current });
      } catch {
        // Rollback is best-effort.
      }
      throw error;
    }
  }, [session]);

  const signInGoogle = useCallback(async (activateSession = true) => {
    setAuthBusy(true);
    try {
      const googleUser = await signInWithGoogle();

      if (!activateSession) return googleUser;

      const nextSession = {
        isAuthenticated: true,
        provider: "google",
        google: googleUser,
        wallet: session.wallet || null
      };
      setSession(nextSession);
      setProfile((prev) => ({
        ...prev,
        name: googleUser.displayName || prev.name,
        email: googleUser.email || prev.email
      }));
      return nextSession;
    } finally {
      setAuthBusy(false);
    }
  }, [session.wallet, setProfile, setSession]);

  const connectWallet = useCallback(async (activateSession = true) => {
    setAuthBusy(true);
    try {
      const wallet = await connectMetaMask();

      if (!activateSession) return wallet;

      const nextSession = {
        isAuthenticated: true,
        provider: wallet.provider,
        google: session.google || null,
        wallet
      };
      setSession(nextSession);
      return nextSession;
    } finally {
      setAuthBusy(false);
    }
  }, [session.google, setSession]);

  const logout = useCallback(async () => {
    await signOutGoogle();
    sessionKeyRef.current = null;
    setSessionUnlocked(false);
    setVaultsState([]);
    setSession(defaultSession);
  }, [setSession, setSessionUnlocked]);

  const lockSession = useCallback(() => {
    sessionKeyRef.current = null;
    setVaultsState([]);
    setSessionUnlocked(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  }, [setSessionUnlocked]);

  const runSessionUnlock = useCallback(async (password, userAddress = null, providerType = null, googleUid = null) => {
    const activeIdentity = session?.wallet || session?.google;
    const targetAddress = userAddress || (await getIdentityAddress(activeIdentity));
    const resolvedProviderType = providerType || session?.provider || "google";
    const uid = googleUid || activeIdentity?.uid;

    if (!targetAddress) {
      return { ok: false, message: "Không tìm thấy địa chỉ ví của bạn." };
    }

    try {
      // Update unlockAndSyncVault call with uid parameter if needed in the future
      const syncResult = await vaultService.unlockAndSyncVault(password, targetAddress, resolvedProviderType, uid);

      sessionKeyRef.current = syncResult.encryptionKey;
      setVaultsState(syncResult.vaults);
      setUserProfileState(syncResult.userProfile || { fullName: "", dob: "", phone: "" });
      setSessionUnlocked(true);
      setHasVaultData(syncResult.vaults.length > 0 || (await vaultService.hasVaultData(targetAddress)));
      setHasMasterPassword(true);

      return { ok: true };
    } catch (error) {
      let message = "Sai mật khẩu master";
      if (error instanceof CryptoOperationError && error.code === "DECRYPT_FAILED") {
        message = "Sai mật khẩu master";
      } else if (error.code === ErrorCodes.IPFS_FETCH_FAILED || error.code === ErrorCodes.SYNC_FAILED) {
        message = error.message || "Không thể tải dữ liệu từ Web3/IPFS. Vui lòng kiểm tra lại.";
      } else {
        message = getUserFriendlyMessage(error) || "Không thể mở khóa phiên. Vui lòng thử lại.";
      }
      return { ok: false, message };
    }
  }, [session]);

  const updateMasterPassword = useCallback(async (currentPassword, nextPassword) => {
    const activeIdentity = session?.wallet || session?.google;
    const userAddress = await getIdentityAddress(activeIdentity);
    if (!userAddress) {
      return { ok: false, message: "Không tìm thấy phiên đăng nhập để đổi mật khẩu" };
    }

    try {
      const rotation = await vaultService.rotateEncryptionKey(currentPassword, nextPassword, userAddress);

      sessionKeyRef.current = rotation.encryptionKey;
      setVaultsState(rotation.vaults);
      setUserProfileState(rotation.userProfile || { fullName: "", dob: "", phone: "" });
      setSessionUnlocked(true);

      await vaultService.saveVaultsWithKey(
        rotation.vaults,
        rotation.encryptionKey,
        userAddress,
        { providerType: session?.provider, uid: session?.google?.uid, userProfile: rotation.userProfile }
      );
      setHasVaultData(rotation.vaults.length > 0 || (await vaultService.hasVaultData(userAddress)));

      return { ok: true };
    } catch (error) {
      return { ok: false, message: getUserFriendlyMessage(error) || "Không thể đổi master password" };
    }
  }, [session]);

  const createMasterPassword = useCallback(async (nextPassword, userAddress = null, providerType = null, googleUid = null, profileData = null) => {
    const activeIdentity = session?.wallet || session?.google;
    const targetAddress = userAddress || (await getIdentityAddress(activeIdentity));
    const resolvedProviderType = providerType || session?.provider || "google";
    const uid = googleUid || activeIdentity?.uid;

    if (!targetAddress) {
      return { ok: false, message: "Không tìm thấy địa chỉ ví của bạn." };
    }

    try {
      const registerResult = await vaultService.registerNewVault(nextPassword, targetAddress, resolvedProviderType, uid, profileData);

      sessionKeyRef.current = registerResult.encryptionKey;
      setVaultsState(registerResult.vaults);
      setUserProfileState(registerResult.userProfile || { fullName: "", dob: "", phone: "" });
      setSessionUnlocked(true);
      setHasVaultData(false);
      setHasMasterPassword(true);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getUserFriendlyMessage(error) || "Không thể đăng ký Master Password lên Blockchain"
      };
    }
  }, [session]);

  const verifyMasterPassword = useCallback(async (password) => {
    const activeIdentity = session?.wallet || session?.google;
    const userAddress = await getIdentityAddress(activeIdentity);
    if (!userAddress) return false;

    try {
      const derived = await vaultService.deriveVaultKeyFromPassword(password, userAddress);
      const loaded = await vaultService.loadVaultsWithKey(derived, userAddress);
      return Array.isArray(loaded);
    } catch {
      return false;
    }
  }, [session]);

  const requestMasterAction = useCallback((purpose, action, options = {}) => {
    const { forceReauth = false } = options;

    if (!forceReauth && isSessionUnlocked) {
      action?.(null);
      return;
    }

    setMasterGate({ open: true, purpose, action, error: "", forceReauth });
  }, [isSessionUnlocked]);

  const requestSessionUnlock = useCallback(() => {
    setMasterGate({
      open: true,
      purpose: "Mở khóa phiên",
      action: null,
      error: "",
      forceReauth: true
    });
  }, []);

  const notify = useCallback((message, type = "info", options = {}) => {
    const action = options.action;
    const duration = options.duration ?? 2600;

    setToast({ message, type, action });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const closeMasterGate = useCallback(() => {
    setMasterGate({ open: false, purpose: "", action: null });
  }, []);

  const confirmMasterGate = useCallback(async (password) => {
    try {
      const result = await runSessionUnlock(password);
      if (!result.ok) {
        setMasterGate((prev) => ({ ...prev, error: result.message || "Sai mật khẩu master" }));
        return result;
      }

      const action = masterGate.action;
      if (action) {
        setMasterGate((prev) => ({ ...prev, isExecuting: true, error: "" }));
        await action(password);
      }
      closeMasterGate();
      return { ok: true };
    } catch (error) {
      const message = getUserFriendlyMessage(error) || "Không thể thực hiện hành động. Vui lòng thử lại.";
      setMasterGate((prev) => ({ ...prev, error: message, isExecuting: false }));
      return { ok: false, message };
    }
  }, [closeMasterGate, masterGate.action, runSessionUnlock]);

  const clearAllVaultData = useCallback(async () => {
    const result = await setVaults([], { disallowFallback: true });
    if (result?.sync?.status === "local_fallback" || result?.sync?.status === "skipped") {
      throw new Error("Không thể đồng bộ trạng thái xóa lên Blockchain. Vui lòng kiểm tra lại kết nối Web3.");
    }
    notify("Đã xóa toàn bộ dữ liệu vault", "warning");
  }, [notify, setVaults]);

  const exportVaultData = useCallback(async (password) => {
    const normalizedPassword = String(password ?? "").trim();
    if (!normalizedPassword) {
      throw new Error("Cần xác thực lại master password trước khi export");
    }
    return vaultService.exportToJson(vaultsRef.current, normalizedPassword);
  }, []);

  const importVaultData = useCallback(async (rawText, importPassword = "") => {
    const normalizedPassword = String(importPassword ?? "").trim();
    const parsedVaults = await vaultService.importFromJson(rawText, normalizedPassword);

    if (!sessionKeyRef.current) {
      throw new Error("Phiên đang khóa. Vui lòng mở khóa trước khi import");
    }
    await setVaults(prevVaults => {
      const updatedVaults = [...prevVaults, ...parsedVaults];
      return updatedVaults;
    }, { disallowFallback: true });

    return parsedVaults;
  }, [setVaults]);

  const resetAutoLockTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!session?.isAuthenticated || !isSessionUnlocked) return;

    inactivityTimerRef.current = setTimeout(() => {
      lockSession();
      requestSessionUnlock();
      notify("Phiên đã tự khóa do không hoạt động", "warning");
    }, Number(autoLockMinutes) * 60 * 1000);
  }, [autoLockMinutes, isSessionUnlocked, lockSession, notify, requestSessionUnlock, session?.isAuthenticated]);

  useEffect(() => {
    if (!session?.isAuthenticated || !isSessionUnlocked) return undefined;

    resetAutoLockTimer();
    const onActivity = () => resetAutoLockTimer();

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, onActivity));
    };
  }, [isSessionUnlocked, resetAutoLockTimer, session?.isAuthenticated]);

  const syncVaultOnLoginIfNeeded = useCallback(async (userAddress, options = {}) => {
    if (!sessionKeyRef.current || !userAddress) {
      return { synced: false, reason: "Phiên chưa được mở khóa." };
    }

    try {
      const encryptionKey = sessionKeyRef.current;
      const syncResult = await vaultService.syncVaultOnLogin(
        encryptionKey,
        userAddress,
        { ...options, providerType: session?.provider }
      );

      if (syncResult.synced) {
        const updatedVaults = syncResult.vaults;
        setUserProfileState(syncResult.userProfile || { fullName: "", dob: "", phone: "" });
        setVaultsState(updatedVaults);
        setHasVaultData(updatedVaults.length > 0 || (await vaultService.hasVaultData(userAddress)));
        return { synced: true, reason: syncResult.reason, count: updatedVaults.length };
      }

      return {
        synced: false,
        reason: syncResult.userMessage || syncResult.reason || "Không có dữ liệu mới trên chain.",
        canRetry: syncResult.canRetry
      };
    } catch (error) {
      return {
        synced: false,
        reason: getUserFriendlyMessage(error),
        canRetry: true
      };
    }
  }, []);

  const value = useMemo(() => ({
    session,
    setSession,
    vaults,
    setVaults,
    profile,
    setProfile,
    theme,
    setTheme,
    search,
    setSearch,
    autoLockMinutes,
    setAutoLockMinutes,
    bootstrapped,
    hasMasterPassword,
    hasVaultData,
    isSessionUnlocked,
    setSessionUnlocked,
    lockSession,
    requestSessionUnlock,
    authBusy,
    masterGate,
    requestMasterAction,
    closeMasterGate,
    confirmMasterGate,
    toast,
    notify,
    clearToast,
    signInGoogle,
    connectWallet,
    logout,
    createMasterPassword,
    verifyMasterPassword,
    updateMasterPassword,
    clearAllVaultData,
    exportVaultData,
    importVaultData,
    unlockWithMasterPassword: runSessionUnlock,
    userProfile,
    setUserProfile: setUserProfileState,
    syncVaultOnLoginIfNeeded,
    encryptionKey: sessionKeyRef.current
  }), [
    session,
    setSession,
    vaults,
    setVaults,
    profile,
    setProfile,
    theme,
    setTheme,
    search,
    setSearch,
    autoLockMinutes,
    setAutoLockMinutes,
    bootstrapped,
    hasMasterPassword,
    hasVaultData,
    isSessionUnlocked,
    setSessionUnlocked,
    lockSession,
    requestSessionUnlock,
    authBusy,
    masterGate,
    requestMasterAction,
    closeMasterGate,
    confirmMasterGate,
    toast,
    notify,
    clearToast,
    signInGoogle,
    connectWallet,
    logout,
    createMasterPassword,
    verifyMasterPassword,
    updateMasterPassword,
    clearAllVaultData,
    exportVaultData,
    importVaultData,
    runSessionUnlock,
    syncVaultOnLoginIfNeeded,
    userProfile,
    setUserProfileState,
    sessionKeyRef.current
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
