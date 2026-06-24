import { Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext";
import ResponsiveSidebar from "../components/navigation/ResponsiveSidebar";
import Topbar from "../components/layout/Topbar";
import MasterPasswordGate from "../components/security/MasterPasswordGate";
import Toast from "../components/ui/Toast";
import { useEffect, useState } from "react";

export default function ShellLayout() {
  const {
    session,
    theme,
    setTheme,
    search,
    setSearch,
    isSessionUnlocked,
    requestSessionUnlock,
    masterGate,
    confirmMasterGate,
    closeMasterGate,
    toast,
    clearToast,
    logout
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (session?.isAuthenticated && !isSessionUnlocked && !masterGate.open) {
      requestSessionUnlock();
    }
  }, [isSessionUnlocked, masterGate.open, requestSessionUnlock, session?.isAuthenticated]);

  return (
    <main className="min-h-screen p-3 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <ResponsiveSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={logout} />
        <section className="relative min-w-0 flex-1">
          <Topbar
            title="DApp Password Manager"
            subtitle="Kho bảo mật"
            onMenuOpen={() => setMobileOpen(true)}
            currentTheme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            session={session}
            search={search}
            setSearch={setSearch}
          />
          <Outlet />
          {!isSessionUnlocked ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-slate-950/60 p-4">
              <div className="panel max-w-md p-6 text-center">
                <h3 className="text-lg font-semibold">Phiên đang bị khóa</h3>
                <p className="mt-2 text-sm text-app-muted">
                  Nhập master password một lần để mở khóa và tiếp tục sử dụng ứng dụng.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button className="btn-soft border-red-500/30 text-red-500 hover:bg-red-500/10" type="button" onClick={logout}>
                    Đăng xuất
                  </button>
                  <button className="btn-primary" type="button" onClick={requestSessionUnlock}>
                    Mở khóa phiên
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <MasterPasswordGate
        open={masterGate.open}
        purpose={masterGate.purpose}
        error={masterGate.error}
        isExecuting={masterGate.isExecuting}
        onClose={closeMasterGate}
        onSubmit={confirmMasterGate}
        onLogout={logout}
      />
      <Toast toast={toast} onClose={clearToast} />
    </main>
  );
}
