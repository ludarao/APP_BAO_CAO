"use client";
import { useState } from "react";
import { Database, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { resetModes, type ResetMode } from "@/lib/reset";
import { Modal } from "./portal";
type Counts = {
  units: number;
  users: number;
  periods: number;
  reports: number;
  revisions: number;
  contacts: number;
};
export default function ResetData({
  notify,
  done,
}: {
  notify: (message: string) => void;
  done: () => Promise<void>;
}) {
  const [mode, setMode] = useState<ResetMode | null>(null),
    [counts, setCounts] = useState<Counts | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [requestId, setRequestId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function open(next: ResetMode) {
    setBusy(true);
    try {
      const data = await api("/api/admin/reset");
      setCounts(data.counts);
      setConfirmation("");
      setPassword("");
      setError("");
      setRequestId(crypto.randomUUID());
      setMode(next);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (!busy) {
      setMode(null);
      setPassword("");
      setConfirmation("");
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!mode || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/admin/reset", {
        mode,
        confirmation,
        password,
        requestId,
      });
      setMode(null);
      setPassword("");
      setConfirmation("");
      await done();
      notify(
        result.repeated
          ? "Thao tác này đã hoàn tất trước đó; không xóa lại dữ liệu."
          : mode === "ALL"
            ? "Đã xóa dữ liệu và đơn vị. Tài khoản admin và lịch mặc định được giữ lại."
            : "Đã xóa dữ liệu báo cáo. Các đơn vị cần đăng nhập lại để nhập mới.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card reset-settings">
      <div className="section-heading">
        <span className="section-icon">
          <Database size={21} />
        </span>
        <div>
          <h2>Reset dữ liệu</h2>
          <p>
            Chỉ quản trị viên được sử dụng. Dữ liệu đã xóa không thể khôi phục
            trong ứng dụng.
          </p>
        </div>
      </div>
      <div className="reset-options">
        {(Object.keys(resetModes) as ResetMode[]).map((key) => (
          <article key={key}>
            <h3>{resetModes[key].title}</h3>
            <p>{resetModes[key].description}</p>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void open(key)}
            >
              <Trash2 size={16} />
              {resetModes[key].title}
            </button>
          </article>
        ))}
      </div>
      {mode && counts && (
        <Modal title={resetModes[mode].title} close={close}>
          <form onSubmit={submit}>
            <div className="alert warning">
              {resetModes[mode].description} Thao tác áp dụng cho toàn hệ thống,
              không chỉ kỳ hoặc đơn vị đang chọn.
            </div>
            <p className="reset-counts">
              Hiện có <strong>{counts.reports}</strong> báo cáo,{" "}
              <strong>{counts.revisions}</strong> lần gửi và{" "}
              <strong>{counts.contacts}</strong> người nhập đã lưu.
              {mode === "ALL" && (
                <>
                  {" "}
                  Đồng thời xóa <strong>{counts.units}</strong> đơn vị,{" "}
                  <strong>{counts.users}</strong> tài khoản đơn vị và{" "}
                  <strong>{counts.periods}</strong> kỳ báo cáo.
                </>
              )}
            </p>
            <p>
              Phiên đăng nhập của các đơn vị sẽ bị thu hồi. Nháp offline trên
              thiết bị khác không thể xóa từ xa; người nhập cần bỏ nháp cũ trước
              khi nhập lại.
            </p>
            <p>
              Bạn có thể xuất Excel trước khi reset. Thao tác này không có nút
              hoàn tác.
            </p>
            <label>
              Nhập <strong>{resetModes[mode].phrase}</strong> để xác nhận
              <input
                autoComplete="off"
                spellCheck={false}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={busy}
                required
              />
            </label>
            <label>
              Mật khẩu admin hiện tại
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                required
              />
            </label>
            {error && (
              <div className="alert warning" role="alert">
                {error}
              </div>
            )}
            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={close}
                disabled={busy}
              >
                Hủy
              </button>
              <button
                className="button danger"
                disabled={
                  busy || confirmation !== resetModes[mode].phrase || !password
                }
              >
                <Trash2 size={16} />
                {busy ? "Đang xóa…" : "Xác nhận xóa vĩnh viễn"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
