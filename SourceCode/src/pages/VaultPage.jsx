import { ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/shared/PageHeader";
import VaultPanel from "../components/vault/VaultPanel";

export default function VaultPage() {
  const { vaults, setVaults, search, notify } = useApp();

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Kho bảo mật"
        title="Danh sách mật khẩu"
        actions={[
          <span key="secure" className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs text-app-text">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            Master password bắt buộc cho thao tác nhạy cảm
          </span>
        ]}
      />

      <VaultPanel
        vaults={vaults}
        setVaults={setVaults}
        search={search}
        onToast={notify}
      />
    </section>
  );
}
