"use client";
import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import {
  BarChart3,
  LayoutDashboard,
  ClipboardList,
  Building2,
  CalendarDays,
  History,
  Settings,
  LogOut,
  ArrowRight,
  ShieldCheck,
  WifiOff,
  Menu,
  X,
  Bell,
  ChevronRight,
  LockKeyhole,
} from "lucide-react";
import { api, loadBootstrap, saveBootstrap, clearOffline } from "@/lib/client";
import type { Bootstrap } from "@/lib/types";
import Admin from "./admin";
import Reporter from "./reporter";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: string | HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}
export default function Portal() {
  const [data, setData] = useState<Bootstrap | null>(null),
    [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false);
  const [tab, setTab] = useState("dashboard"),
    [notice, setNotice] = useState(""),
    [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false),
    [clear, setClear] = useState(true),
    [expired, setExpired] = useState(false);
  const notify = useCallback((message: string) => {
    setNotice(message);
  }, []);
  const refresh = useCallback(
    async (periodId?: string) => {
      try {
        const value = await api(
          `/api/bootstrap${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`,
        );
        setData(value);
        setExpired(false);
        if (value.me.role === "UNIT") await saveBootstrap(value);
        else localStorage.removeItem("report-last-user");
      } catch (e) {
        if ((e as { status?: number }).status === 401) {
          setExpired(localStorage.getItem("report-last-user") !== null);
          setData(null);
        } else if (!navigator.onLine || !(e as { status?: number }).status) {
          const cached = await loadBootstrap();
          if (cached?.me.role === "UNIT") {
            setData(cached);
            setOffline(true);
          } else notify("Cần có mạng để đăng nhập lần đầu trên thiết bị này.");
        } else notify((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );
  useEffect(() => {
    const expired = () => {
      setExpired(true);
      setData(null);
    };
    const connected = () => setOffline(false);
    window.addEventListener("auth-expired", expired);
    window.addEventListener("server-connected", connected);
    return () => {
      window.removeEventListener("auth-expired", expired);
      window.removeEventListener("server-connected", connected);
    };
  }, []);
  useEffect(() => {
    setOffline(!navigator.onLine);
    void refresh();
    const on = () => setOffline(false),
      off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          const urls = [
            ...Array.from(document.scripts).map((s) => s.src),
            ...Array.from(
              document.querySelectorAll<HTMLLinkElement>(
                'link[rel="stylesheet"]',
              ),
            ).map((l) => l.href),
            ...performance.getEntriesByType("resource").map((r) => r.name),
          ];
          reg.active?.postMessage({ type: "CACHE_ASSETS", urls });
        })
        .catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 10000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function signout() {
    try {
      await api("/api/auth/logout", {});
      if (clear) await clearOffline();
      else {
        localStorage.removeItem("report-last-user");
      }
      setData(null);
      setLogout(false);
      setExpired(false);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <span className="spinner" />
        <p>Đang mở cổng báo cáo…</p>
      </div>
    );
  if (!data)
    return (
      <>
        <Login expired={expired} onSuccess={() => refresh()} notify={notify} />
        {notice && <Toast text={notice} close={() => setNotice("")} />}
      </>
    );
  const admin = data.me.role === "ADMIN";
  const items = admin
    ? ([
        ["dashboard", "Tổng quan", LayoutDashboard],
        ["reports", "Theo dõi báo cáo", ClipboardList],
        ["units", "Đơn vị & tài khoản", Building2],
        ["periods", "Kỳ báo cáo", CalendarDays],
        ["audit", "Nhật ký hệ thống", History],
      ] as const)
    : ([
        ["dashboard", "Tổng quan", LayoutDashboard],
        ["reports", "Nhập báo cáo", ClipboardList],
      ] as const);
  const titles: Record<string, string> = {
    dashboard: "Tổng quan",
    reports: admin ? "Theo dõi báo cáo" : "Nhập báo cáo",
    units: "Đơn vị & tài khoản",
    periods: "Quản lý kỳ báo cáo",
    audit: "Nhật ký hệ thống",
    settings: "Tài khoản của bạn",
  };
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="scrim"
          aria-label="Đóng menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {items.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              onClick={() => {
                setTab(id);
                setMenu(false);
              }}
            >
              <Icon size={19} />
              {label}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-tip">
            <ShieldCheck size={20} />
            <strong>Dữ liệu được phân quyền</strong>
            <p>
              {admin
                ? "Quản lý tập trung theo từng đơn vị và kỳ báo cáo."
                : "Bản nháp tự lưu trên thiết bị khi bạn nhập."}
            </p>
          </div>
          <button
            className={`nav-item ${tab === "settings" ? "active" : ""}`}
            onClick={() => setTab("settings")}
          >
            <Settings size={19} />
            Cài đặt tài khoản
          </button>
          <button className="nav-item" onClick={() => setLogout(true)}>
            <LogOut size={19} />
            Đăng xuất
          </button>
          <div className="sidebar-foot">
            PX03 <span>·</span> Cổng báo cáo đơn vị
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Mở menu"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span>Không gian {admin ? "quản trị" : "đơn vị"}</span>
            <ChevronRight size={14} />
            <strong>{titles[tab]}</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${offline ? "is-offline" : ""}`}>
              {offline ? (
                <WifiOff size={14} />
              ) : (
                <span className="status-dot" />
              )}
              {offline ? "Đang offline" : "Đã kết nối"}
            </span>
            <span className="top-divider" />
            <button className="profile" onClick={() => setTab("settings")}>
              <span className="avatar">
                {admin ? "QT" : data.me.unit?.code.slice(0, 2)}
              </span>
              <span>
                <strong>{admin ? "Quản trị viên" : data.me.unit?.code}</strong>
                <small>{data.me.username}</small>
              </span>
            </button>
          </div>
        </header>
        <main>
          {offline && (
            <div className="alert warning">
              <WifiOff size={18} />
              Đang dùng dữ liệu đã tải trên thiết bị. Bạn có thể nhập nháp và
              gửi khi có mạng.
            </div>
          )}
          {data.me.mustChangePassword ? (
            <PasswordForm forced onDone={() => refresh()} notify={notify} />
          ) : tab === "settings" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TÀI KHOẢN</div>
                  <h1>Thiết lập bảo mật</h1>
                  <p>{data.me.unit?.name || "Tài khoản quản trị hệ thống"}</p>
                </div>
              </div>
              <PasswordForm
                onDone={() =>
                  notify("Đã đổi mật khẩu và thu hồi các phiên cũ.")
                }
                notify={notify}
              />
            </>
          ) : admin ? (
            <Admin data={data} tab={tab} refresh={refresh} notify={notify} />
          ) : (
            <Reporter
              data={data}
              tab={tab}
              setTab={setTab}
              refresh={refresh}
              notify={notify}
            />
          )}
        </main>
        <footer className="main-footer">
          <span>Cổng báo cáo đơn vị · PX03</span>
          <span>Thời gian theo múi giờ Việt Nam (UTC+7)</span>
        </footer>
      </div>
      {notice && <Toast text={notice} close={() => setNotice("")} />}
      {logout && (
        <Modal title="Đăng xuất tài khoản" close={() => setLogout(false)}>
          <p>Bản nháp chưa gửi chỉ được lưu trên thiết bị này.</p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={clear}
              onChange={(e) => setClear(e.target.checked)}
            />
            Xóa bản nháp và dữ liệu offline trên thiết bị
          </label>
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => setLogout(false)}
            >
              Ở lại
            </button>
            <button className="button" onClick={signout}>
              Đăng xuất
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <BarChart3 size={25} />
      </span>
      <span>
        <strong>
          Cổng báo cáo<span className="brand-period">.</span>
        </strong>
        <small>QUẢN LÝ SỐ LIỆU ĐƠN VỊ</small>
      </span>
    </div>
  );
}
function Login({
  onSuccess,
  notify,
  expired,
}: {
  onSuccess: () => void;
  notify: (s: string) => void;
  expired: boolean;
}) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!siteKey || !scriptReady || !window.turnstile) return;
    const id = window.turnstile.render("#turnstile", {
      sitekey: siteKey,
      action: "login",
      language: "vi",
      callback: (t: string) => setToken(t),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
    return () => window.turnstile?.remove(id);
  }, [scriptReady, siteKey]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/login", {
        username,
        password,
        turnstileToken: token,
      });
      onSuccess();
    } catch (e) {
      notify((e as Error).message);
      setToken("");
      window.turnstile?.reset();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-story-main">
          <div className="login-tag">
            <span className="status-dot" /> HỆ THỐNG BÁO CÁO TẬP TRUNG
          </div>
          <h1>
            Số liệu đầy đủ.
            <br />
            Tổng hợp kịp thời.
          </h1>
          <p>
            Một không gian thống nhất để các đơn vị báo cáo, theo dõi tiến độ và
            tổng hợp kết quả thực hiện.
          </p>
          <div className="story-steps">
            <div>
              <span>01</span>
              <p>
                Chọn kỳ báo cáo<strong>Đúng biểu, đúng thời gian</strong>
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                Nhập số liệu thuận tiện
                <strong>Tự lưu nháp trên thiết bị</strong>
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                Rà soát và gửi<strong>Nhận xác nhận từ hệ thống</strong>
              </p>
            </div>
          </div>
        </div>
        <div className="login-story-foot">
          PX03 · Chương trình hành động số 10/CTr-BCA-X03
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-card">
          <div className="login-lock">
            <LockKeyhole size={26} />
          </div>
          <div className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</div>
          <h2>Đăng nhập hệ thống</h2>
          <p>Sử dụng tài khoản được cấp cho đơn vị của bạn.</p>
          {expired && (
            <div className="alert">
              Đăng nhập để mở dữ liệu và tiếp tục bản nháp.
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Tên đăng nhập
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tên tài khoản đơn vị"
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn"
                required
              />
            </label>
            {siteKey ? (
              <>
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                  onReady={() => setScriptReady(true)}
                />
                <div id="turnstile" />
              </>
            ) : (
              <div className="login-verify">
                <ShieldCheck size={17} />
                {process.env.NODE_ENV === "development"
                  ? "Môi trường kiểm tra local"
                  : "Cần cấu hình Turnstile để đăng nhập"}
              </div>
            )}
            <button
              className="button full"
              disabled={busy || (!!siteKey && !token)}
            >
              {busy ? "Đang xác minh…" : "Đăng nhập"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-help">
            Chưa có tài khoản hoặc quên mật khẩu?
            <br />
            Liên hệ quản trị viên để được cấp lại.
          </p>
        </div>
        <div className="login-bottom">
          <ShieldCheck size={14} /> Truy cập được xác thực · Dữ liệu theo từng
          đơn vị
        </div>
      </section>
    </div>
  );
}
export function PasswordForm({
  forced = false,
  onDone,
  notify,
}: {
  forced?: boolean;
  onDone: () => void;
  notify: (s: string) => void;
}) {
  const [oldPassword, setOld] = useState(""),
    [newPassword, setNew] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm)
      return notify("Hai lần nhập mật khẩu mới chưa khớp.");
    setBusy(true);
    try {
      await api("/api/auth/password", { oldPassword, newPassword });
      setOld("");
      setNew("");
      setConfirm("");
      onDone();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card password-card">
      <div className="section-heading">
        <span className="section-icon">
          <LockKeyhole size={21} />
        </span>
        <div>
          <h2>{forced ? "Đổi mật khẩu lần đầu" : "Đổi mật khẩu"}</h2>
          <p>
            {forced
              ? "Hãy đặt mật khẩu riêng trước khi sử dụng hệ thống."
              : "Các phiên đăng nhập khác sẽ được thu hồi."}
          </p>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            value={oldPassword}
            autoComplete="current-password"
            onChange={(e) => setOld(e.target.value)}
            required
          />
        </label>
        <label>
          Mật khẩu mới
          <input
            type="password"
            minLength={12}
            maxLength={72}
            value={newPassword}
            autoComplete="new-password"
            onChange={(e) => setNew(e.target.value)}
            required
          />
          <small>Ít nhất 12 ký tự, tối đa 72 byte.</small>
        </label>
        <label>
          Nhập lại mật khẩu mới
          <input
            type="password"
            value={confirm}
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Đang cập nhật…" : "Lưu mật khẩu mới"}
        </button>
      </form>
    </section>
  );
}
export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Toast({ text, close }: { text: string; close: () => void }) {
  return (
    <div className="toast" role="status">
      <Bell size={18} />
      <span>{text}</span>
      <button aria-label="Đóng thông báo" onClick={close}>
        <X size={16} />
      </button>
    </div>
  );
}
