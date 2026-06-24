import { useState } from "react";
import Modal from "../ui/Modal";

export default function MasterPasswordGate({ open, purpose, error, isExecuting = false, onClose, onSubmit, onLogout }) {
  const [password, setPassword] = useState("");

  const isUnlockSession = purpose === "Mở khóa phiên";

  return (
    <Modal open={open} title={`Xác thực master password - ${purpose}`} onClose={isExecuting ? () => {} : onClose}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await onSubmit(password);
          if (result?.ok) {
            setPassword("");
          }
        }}
      >
        <input
          className="field disabled:opacity-50 disabled:cursor-not-allowed"
          type="password"
          placeholder="Nhập master password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isExecuting}
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <div className="flex justify-end gap-2">
          {isUnlockSession && onLogout ? (
            <button
              className="btn-soft border-red-500/30 text-red-500 hover:bg-red-500/10 mr-auto disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              onClick={() => {
                setPassword("");
                onLogout();
              }}
              disabled={isExecuting}
            >
              Đăng xuất
            </button>
          ) : null}
          <button className="btn-soft" type="button" onClick={onClose} disabled={isExecuting}>
            Hủy
          </button>
          <button className="btn-primary flex items-center justify-center gap-2 min-w-[90px]" type="submit" disabled={isExecuting}>
            {isExecuting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang xử lý...
              </>
            ) : (
              "Xác nhận"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

