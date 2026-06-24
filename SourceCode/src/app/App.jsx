import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "../context/AppContext";

const AuthPage = lazy(() => import("../pages/AuthPage"));
const VaultPage = lazy(() => import("../pages/VaultPage"));
const GeneratorPage = lazy(() => import("../pages/GeneratorPage"));
const ImportExportPage = lazy(() => import("../pages/ImportExportPage"));
const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const SecurityPage = lazy(() => import("../pages/SecurityPage"));
const ShellLayout = lazy(() => import("../layouts/ShellLayout"));

function ProtectedRoute({ children }) {
  const { session, bootstrapped } = useApp();

  if (!bootstrapped) {
    return <div className="flex min-h-screen items-center justify-center text-app-muted">Đang khởi tạo...</div>;
  }

  if (!session?.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center text-app-muted">Đang tải giao diện...</div>}
    >
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <ShellLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="vault" replace />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="tools/generator" element={<GeneratorPage />} />
          <Route path="tools/import-export" element={<ImportExportPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings/security" element={<SecurityPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/app/vault" replace />} />
        <Route path="*" element={<Navigate to="/app/vault" replace />} />
      </Routes>
    </Suspense>
  );
}
