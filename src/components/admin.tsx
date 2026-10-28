"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCheck,
  Clock3,
  ClipboardList,
  FileClock,
  FileSpreadsheet,
  Filter,
  History,
  KeyRound,
  LockKeyhole,
  Plus,
  RotateCw,
  Search,
  Send,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/client";
import { fields, formatDate, kinds, slug, timing } from "@/lib/forms";
import { unitRowSchema } from "@/lib/admin";
import type { Assignment, Bootstrap, Period, Unit } from "@/lib/types";
import { Modal } from "./portal";

type Props = {
  data: Bootstrap;
  tab: string;
  refresh: (id?: string) => Promise<void>;
  notify: (v: string) => void;
};
type Credential = { code?: string; username: string; password: string };
type UnitRow = {
  code: string;
  name: string;
  group: string;
  parentCode: string;
  username: string;
  scope: "DIRECT" | "INCLUDES_CHILDREN";
};
const statusText: Record<string, string> = {
  EMPTY: "Chưa nhận dữ liệu",
  DRAFT: "Đã gửi tạm",
  ON_TIME: "Đủ đúng hạn",
  LATE: "Đủ nộp muộn",
  OVERDUE: "Quá hạn chưa đủ",
};
function state(a: Assignment, p?: Period) {
  const t = timing(a.dueAt || p!.dueAt, a.report?.firstCompleteAt);
  return a.report?.status === "COMPLETE"
    ? t
    : t === "OVERDUE"
      ? "OVERDUE"
      : a.report
        ? "DRAFT"
        : "EMPTY";
}
const icons = [ClipboardList, CheckCheck, FileClock, Clock3, XCircle];
export default function Admin({ data, tab, refresh, notify }: Props) {
  const periods = data.periods || [],
    units = data.units || [],
    assignments = data.assignments || [];
  const period = periods.find((p) => p.id === data.selectedId);
  const [search, setSearch] = useState(""),
    [group, setGroup] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState(""),
    [credentials, setCredentials] = useState<Credential[]>([]),
    [busy, setBusy] = useState(false),
    [includeDrafts, setIncludeDrafts] = useState(false);
  const [audits, setAudits] = useState<
      {
        id: string;
        action: string;
        target: string;
        createdAt: string;
        detail: unknown;
      }[]
    >([]),
    [revisions, setRevisions] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
    setSelected([]);
  }, [data.selectedId, search, status, group, tab]);
  useEffect(() => {
    if (tab === "audit")
      api("/api/admin/history")
        .then((r) => setAudits(r.audits))
        .catch((e) => notify(e.message));
  }, [tab, notify]);
  const filtered = assignments.filter(
    (a) =>
      (!search ||
        `${a.unit.code} ${a.unit.name}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!group || a.unit.group === group) &&
      (!status || state(a, period) === status),
  );
  const stats = [
    assignments.length,
    assignments.filter((a) => a.report?.status === "COMPLETE").length,
    assignments.filter((a) => a.report?.status === "DRAFT").length,
    assignments.filter(
      (a) =>
        a.report?.status === "COMPLETE" &&
        timing(a.dueAt || period!.dueAt, a.report.firstCompleteAt) === "LATE",
    ).length,
    assignments.filter((a) => !a.report || a.report.status !== "COMPLETE")
      .length,
  ];
  const finished = stats[0] ? Math.round((stats[1] / stats[0]) * 100) : 0;
  async function exportFile() {
    if (!period || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/export?periodId=${period.id}&drafts=${includeDrafts}`,
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `bao-cao-${slug(period.title)}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resetAccount(userId?: string) {
    if (
      !userId ||
      !confirm("Đặt lại mật khẩu sẽ thu hồi các phiên của tài khoản. Tiếp tục?")
    )
      return;
    try {
      const result = await api("/api/admin/accounts", { userId });
      setCredentials([result]);
      setModal("credentials");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function toggleUnit(u: Unit) {
    if (!confirm(`${u.active ? "Khóa" : "Mở khóa"} đơn vị ${u.name}?`)) return;
    try {
      await api(
        "/api/admin/units",
        { unitId: u.id, active: !u.active },
        "PATCH",
      );
      await refresh(data.selectedId);
      notify("Đã cập nhật trạng thái đơn vị.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function showHistory(a: Assignment) {
    if (!a.report) return;
    try {
      const r = await api(`/api/admin/history?reportId=${a.report.id}`);
      setRevisions(r.revisions);
      setModal("history");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const headings: Record<
    string,
    { eyebrow: string; title: string; text: string }
  > = {
    dashboard: {
      eyebrow: "ĐIỀU HÀNH BÁO CÁO",
      title: "Nắm bắt tiến độ, kịp thời tổng hợp",
      text: "Theo dõi số liệu và tình hình nộp báo cáo của các đơn vị.",
    },
    reports: {
      eyebrow: "THEO DÕI BÁO CÁO",
      title: "Tiến độ theo từng đơn vị",
      text: "Kiểm tra mức hoàn thành, hạn nộp và lịch sử cập nhật.",
    },
    units: {
      eyebrow: "QUẢN TRỊ HỆ THỐNG",
      title: "Đơn vị & tài khoản",
      text: "Cấp tài khoản, nhập danh sách Excel và quản lý quyền truy cập.",
    },
    periods: {
      eyebrow: "TỔ CHỨC BÁO CÁO",
      title: "Các kỳ báo cáo",
      text: "Thiết lập khoảng số liệu, thời gian nhận và đơn vị được giao.",
    },
    audit: {
      eyebrow: "LỊCH SỬ QUẢN TRỊ",
      title: "Nhật ký hệ thống",
      text: "100 thao tác quản trị gần nhất được lưu để đối chiếu.",
    },
  };
  const h = headings[tab] || headings.dashboard;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{h.eyebrow}</div>
          <h1>{h.title}</h1>
          <p>{h.text}</p>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => refresh(data.selectedId)}
          >
            <RotateCw size={16} />
            Làm mới
          </button>
          {tab === "units" ? (
            <>
              <button
                className="button secondary"
                onClick={() => setModal("unit")}
              >
                <Plus size={16} />
                Thêm đơn vị
              </button>
              <button className="button" onClick={() => setModal("import")}>
                <Upload size={16} />
                Nhập Excel
              </button>
            </>
          ) : tab === "periods" ? (
            <button className="button" onClick={() => setModal("period")}>
              <Plus size={17} />
              Tạo kỳ báo cáo
            </button>
          ) : tab !== "audit" ? (
            <button
              className="button"
              disabled={!period || busy}
              onClick={exportFile}
            >
              <ArrowDownToLine size={16} />
              {busy ? "Đang xuất…" : "Xuất báo cáo"}
            </button>
          ) : null}
        </div>
      </div>
      {(tab === "dashboard" || tab === "reports") && (
        <>
          <div className="period-toolbar card">
            <div className="period-picker">
              <span className="section-icon">
                <CalendarDays size={21} />
              </span>
              <div>
                <label htmlFor="period-select">KỲ BÁO CÁO ĐANG THEO DÕI</label>
                <select
                  id="period-select"
                  value={data.selectedId || ""}
                  onChange={(e) => refresh(e.target.value)}
                >
                  <option value="" disabled>
                    Chưa có kỳ báo cáo
                  </option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="toolbar-meta">
              {period && (
                <>
                  <span
                    className={`badge ${new Date() < new Date(period.opensAt) ? "neutral" : new Date() > new Date(period.closesAt) ? "amber" : "green"}`}
                  >
                    <span className="status-dot" />
                    {new Date() < new Date(period.opensAt)
                      ? "Chưa mở"
                      : new Date() > new Date(period.closesAt)
                        ? "Đã khóa"
                        : "Đang nhận báo cáo"}
                  </span>
                  <span>
                    Hạn chung: <strong>{formatDate(period.dueAt)}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="stats five">
            {[
              "Đơn vị phải báo cáo",
              "Đã nộp đầy đủ",
              "Đã gửi tạm",
              "Đủ nhưng nộp muộn",
              "Chưa nộp đủ",
            ].map((label, i) => {
              const Icon = icons[i];
              return (
                <div className="card stat-card" key={label}>
                  <div className="row-between">
                    <span>{label}</span>
                    <span className={`stat-icon stat-${i}`}>
                      <Icon size={18} />
                    </span>
                  </div>
                  <strong
                    className={
                      i === 1 ? "text-green" : i === 4 ? "text-amber" : ""
                    }
                  >
                    {stats[i].toString().padStart(2, "0")}
                  </strong>
                  <small>
                    {
                      [
                        "Theo danh sách được giao",
                        `${finished}% tổng số đơn vị`,
                        "Máy chủ đã nhận bản tạm",
                        "Theo hạn có hiệu lực",
                        "Chưa gửi hoặc còn thiếu",
                      ][i]
                    }
                  </small>
                </div>
              );
            })}
          </div>
          {tab === "dashboard" && (
            <div className="overview-grid">
              <section className="card overview-progress">
                <div className="row-between">
                  <div>
                    <h2>Tiến độ hoàn thành</h2>
                    <p>Chỉ tính các báo cáo đã nộp đủ</p>
                  </div>
                  <span className="subtle-tag">
                    {period ? kinds[period.kind] : "Chưa có kỳ"}
                  </span>
                </div>
                <div className="progress-body">
                  <div
                    className="donut"
                    style={
                      { "--progress": `${finished}%` } as React.CSSProperties
                    }
                  >
                    <div>
                      <strong>
                        {finished}
                        <small>%</small>
                      </strong>
                      <span>hoàn thành</span>
                    </div>
                  </div>
                  <div className="progress-legend">
                    {[
                      { label: "Đã nộp đủ", value: stats[1], color: "green" },
                      { label: "Đã gửi tạm", value: stats[2], color: "blue" },
                      {
                        label: "Chưa gửi",
                        value: assignments.filter((a) => !a.report).length,
                        color: "gray",
                      },
                    ].map((s) => (
                      <div key={s.label}>
                        <span className={`legend-dot ${s.color}`} />
                        <span>{s.label}</span>
                        <strong>{s.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-bottom-note">
                  Cập nhật lúc{" "}
                  {data.refreshedAt ? formatDate(data.refreshedAt) : "—"} · Nhấn
                  Làm mới để cập nhật
                </div>
              </section>
              <section className="card attention-card">
                <div className="row-between">
                  <div>
                    <h2>Cần theo dõi</h2>
                    <p>Những việc cần xử lý trong kỳ</p>
                  </div>
                  <span className="section-icon amber">
                    <Clock3 size={21} />
                  </span>
                </div>
                <div className="attention-row">
                  <span className="attention-number">
                    {
                      assignments.filter((a) => state(a, period) === "OVERDUE")
                        .length
                    }
                  </span>
                  <div>
                    <strong>Đơn vị quá hạn chưa nộp đủ</strong>
                    <p>Kiểm tra và nhắc hoàn thành báo cáo</p>
                  </div>
                  <ArrowRight size={18} />
                </div>
                <div className="attention-row">
                  <span className="attention-number blue">{stats[2]}</span>
                  <div>
                    <strong>Bản gửi tạm cần bổ sung</strong>
                    <p>Đơn vị đã gửi nhưng chưa xác nhận nộp đủ</p>
                  </div>
                  <ArrowRight size={18} />
                </div>
                <button
                  className="button secondary full"
                  disabled={!period}
                  onClick={() => setModal("reminder")}
                >
                  <Send size={15} />
                  Xem danh sách cần nhắc
                </button>
              </section>
            </div>
          )}
          <section className="card report-list">
            <div className="table-title">
              <div>
                <h2>Tình hình báo cáo của đơn vị</h2>
                <p>
                  Nháp chưa gửi trên thiết bị chưa xuất hiện trong danh sách.
                </p>
              </div>
              <button
                className="button secondary small"
                disabled={!period}
                onClick={() => setModal("deadline")}
              >
                <Clock3 size={15} />
                Điều chỉnh thời gian
              </button>
            </div>
            <div className="table-filters">
              <div className="search-box">
                <Search size={17} />
                <input
                  aria-label="Tìm đơn vị"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tên hoặc mã đơn vị…"
                />
              </div>
              <select
                aria-label="Lọc nhóm đơn vị"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="">Tất cả nhóm đơn vị</option>
                {[...new Set(assignments.map((a) => a.unit.group))].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              <select
                aria-label="Lọc trạng thái"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statusText).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="Chọn trang đơn vị"
                        type="checkbox"
                        checked={
                          !!filtered.slice(page * 20, page * 20 + 20).length &&
                          filtered
                            .slice(page * 20, page * 20 + 20)
                            .every((a) => selected.includes(a.unitId))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [
                                  ...new Set([
                                    ...selected,
                                    ...filtered
                                      .slice(page * 20, page * 20 + 20)
                                      .map((a) => a.unitId),
                                  ]),
                                ]
                              : selected.filter(
                                  (id) =>
                                    !filtered
                                      .slice(page * 20, page * 20 + 20)
                                      .some((a) => a.unitId === id),
                                ),
                          )
                        }
                      />
                    </th>
                    <th>ĐƠN VỊ</th>
                    <th>TRẠNG THÁI</th>
                    <th>TIẾN ĐỘ</th>
                    <th>HẠN NỘP</th>
                    <th>CẬP NHẬT CUỐI</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * 20, page * 20 + 20).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <input
                          aria-label={`Chọn ${a.unit.code}`}
                          type="checkbox"
                          checked={selected.includes(a.unitId)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, a.unitId]
                                : selected.filter((id) => id !== a.unitId),
                            )
                          }
                        />
                      </td>
                      <td>
                        <div className="unit-cell">
                          <span className="unit-icon">
                            <Building2 size={18} />
                          </span>
                          <div>
                            <strong>{a.unit.name}</strong>
                            <small>
                              {a.unit.code} · {a.unit.group}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Status value={state(a, period)} />
                      </td>
                      <td>
                        <span className="table-progress-label">
                          {a.report
                            ? `${a.report.completed}/${a.report.required} ô`
                            : "Chưa có dữ liệu"}
                        </span>
                        <div className="progress-track small-track">
                          <span
                            style={{
                              width: `${a.report ? (a.report.completed / a.report.required) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="nowrap">
                        {formatDate(a.dueAt || period!.dueAt)}
                        {a.dueAt && (
                          <small className="text-green">Hạn riêng</small>
                        )}
                      </td>
                      <td className="nowrap">
                        {a.report ? (
                          <>
                            {formatDate(a.report.updatedAt)}
                            <small>{a.report.reporterName}</small>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          disabled={!a.report}
                          aria-label={`Lịch sử ${a.unit.name}`}
                          onClick={() => showHistory(a)}
                        >
                          <History size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="empty">
                  <ClipboardList size={30} />
                  <h3>
                    {period ? "Không có đơn vị phù hợp" : "Chưa có kỳ báo cáo"}
                  </h3>
                  <p>
                    {period
                      ? "Thử thay đổi bộ lọc hoặc thêm đơn vị vào kỳ mới."
                      : "Bắt đầu bằng cách thêm đơn vị và tạo kỳ báo cáo."}
                  </p>
                  {!period && (
                    <button
                      className="button"
                      onClick={() => setModal("period")}
                    >
                      <Plus size={16} />
                      Tạo kỳ báo cáo
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="table-footer">
              <span>
                {selected.length ? `Đã chọn ${selected.length} đơn vị · ` : ""}
                Hiển thị {Math.min(page * 20 + 1, filtered.length)}–
                {Math.min(page * 20 + 20, filtered.length)} / {filtered.length}{" "}
                đơn vị
              </span>
              <div className="actions">
                <label className="check-row compact">
                  <input
                    type="checkbox"
                    checked={includeDrafts}
                    onChange={(e) => setIncludeDrafts(e.target.checked)}
                  />
                  Xuất gồm bản tạm
                </label>
                <button
                  className="button secondary small"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Trước
                </button>
                <button
                  className="button secondary small"
                  disabled={(page + 1) * 20 >= filtered.length}
                  onClick={() => setPage(page + 1)}
                >
                  Sau
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      {tab === "units" && (
        <section className="card">
          <div className="table-title">
            <div>
              <h2>Danh sách đơn vị</h2>
              <p>
                {units.length} đơn vị · {units.filter((u) => u.active).length}{" "}
                đang hoạt động
              </p>
            </div>
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Tìm đơn vị"
                placeholder="Tìm đơn vị…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ĐƠN VỊ</th>
                  <th>NHÓM / CẤP TRÊN</th>
                  <th>TÊN ĐĂNG NHẬP</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {units
                  .filter(
                    (u) =>
                      !search ||
                      `${u.code} ${u.name}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <small>
                          {u.code}
                          {u.scope === "INCLUDES_CHILDREN"
                            ? " · Số liệu gồm cấp dưới"
                            : ""}
                        </small>
                      </td>
                      <td>
                        {u.group}
                        <small>
                          {u.parentCode
                            ? `Cấp trên: ${u.parentCode}`
                            : "Không có cấp trên"}
                        </small>
                      </td>
                      <td>
                        <code>{u.users?.[0]?.username || "Chưa cấp"}</code>
                      </td>
                      <td>
                        <span
                          className={`badge ${u.active ? "green" : "neutral"}`}
                        >
                          {u.active ? "Hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="button secondary small"
                            onClick={() => resetAccount(u.users?.[0]?.id)}
                          >
                            <KeyRound size={14} />
                            Đặt lại MK
                          </button>
                          <button
                            className="icon-button"
                            title={u.active ? "Khóa đơn vị" : "Mở khóa"}
                            aria-label={u.active ? "Khóa đơn vị" : "Mở khóa"}
                            onClick={() => toggleUnit(u)}
                          >
                            <LockKeyhole size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!units.length && (
              <div className="empty">
                <Building2 size={34} />
                <h3>Thêm những đơn vị đầu tiên</h3>
                <p>
                  Tạo thủ công hoặc tải danh sách từ Excel để cấp tài khoản hàng
                  loạt.
                </p>
                <button className="button" onClick={() => setModal("import")}>
                  <Upload size={16} />
                  Nhập danh sách Excel
                </button>
              </div>
            )}
          </div>
        </section>
      )}
      {tab === "periods" && (
        <div className="period-grid">
          {periods.map((p) => (
            <article className="card period-card" key={p.id}>
              <div className="row-between">
                <span className="kind-badge">
                  BÁO CÁO {kinds[p.kind].toUpperCase()}
                </span>
                <CalendarDays size={20} />
              </div>
              <h3>{p.title}</h3>
              <p>{p._count?.assignments || 0} đơn vị được giao</p>
              <dl>
                <div>
                  <dt>Khoảng số liệu</dt>
                  <dd>
                    {formatDate(p.startAt)} — {formatDate(p.endAt)}
                  </dd>
                </div>
                <div>
                  <dt>Mở nhập</dt>
                  <dd>{formatDate(p.opensAt)}</dd>
                </div>
                <div>
                  <dt>Hạn đúng giờ</dt>
                  <dd>{formatDate(p.dueAt)}</dd>
                </div>
                <div>
                  <dt>Khóa nhận</dt>
                  <dd>{formatDate(p.closesAt)}</dd>
                </div>
              </dl>
              <button
                className="button secondary full"
                onClick={async () => {
                  await refresh(p.id);
                  setModal("deadline");
                }}
              >
                Chỉnh thời gian kỳ
                <ArrowRight size={16} />
              </button>
            </article>
          ))}
          {!periods.length && (
            <div className="card empty">
              <CalendarDays size={34} />
              <h3>Chưa có kỳ báo cáo</h3>
              <p>
                Tạo kỳ tuần, tháng, quý, 6 tháng hoặc năm và giao cho các đơn
                vị.
              </p>
            </div>
          )}
        </div>
      )}
      {tab === "audit" && (
        <section className="card audit-list">
          {!audits.length && (
            <div className="empty">Chưa có thao tác quản trị.</div>
          )}
          {audits.map((a) => (
            <details key={a.id}>
              <summary>
                <span className="section-icon">
                  <History size={17} />
                </span>
                <strong>
                  {(
                    {
                      IMPORT_UNITS: "Nhập danh sách đơn vị",
                      CREATE_PERIOD: "Tạo kỳ báo cáo",
                      CHANGE_DEADLINE: "Thay đổi thời gian nhập",
                      RESET_PASSWORD: "Đặt lại mật khẩu",
                      UNIT_ACTIVE: "Đổi trạng thái đơn vị",
                    } as Record<string, string>
                  )[a.action] || a.action}
                </strong>
                <span>{formatDate(a.createdAt)}</span>
              </summary>
              <pre>{JSON.stringify(a.detail, null, 2)}</pre>
            </details>
          ))}
        </section>
      )}
      {(modal === "import" || modal === "unit") && (
        <ImportUnits
          manual={modal === "unit"}
          close={() => setModal("")}
          notify={notify}
          onDone={async (creds) => {
            await refresh(data.selectedId);
            setCredentials(creds);
            setModal(creds.length ? "credentials" : "");
          }}
        />
      )}
      {modal === "period" && (
        <NewPeriod
          units={units}
          close={() => setModal("")}
          notify={notify}
          done={async (id) => {
            await refresh(id);
            setModal("");
          }}
        />
      )}
      {modal === "deadline" && period && (
        <Deadline
          period={period}
          assignments={assignments}
          selected={selected}
          close={() => setModal("")}
          notify={notify}
          done={async () => {
            await refresh(period.id);
            setModal("");
          }}
        />
      )}
      {modal === "credentials" && (
        <Modal
          title="Thông tin tài khoản vừa cấp"
          close={() => setModal("")}
          wide
        >
          <div className="alert warning">
            Mật khẩu chỉ hiển thị trong lần cấp này. Hãy tải danh sách trước khi
            đóng.
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã đơn vị</th>
                  <th>Tài khoản</th>
                  <th>Mật khẩu khởi tạo</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.username}>
                    <td>{c.code || "—"}</td>
                    <td>
                      <code>{c.username}</code>
                    </td>
                    <td>
                      <code>{c.password}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions end">
            <button
              className="button"
              onClick={() => exportCredentials(credentials)}
            >
              <ArrowDownToLine size={16} />
              Tải danh sách tài khoản
            </button>
          </div>
        </Modal>
      )}
      {modal === "reminder" && (
        <Modal
          title="Danh sách đơn vị cần nhắc"
          close={() => setModal("")}
          wide
        >
          <p>
            {period?.title} ·{" "}
            {assignments.filter((a) => a.report?.status !== "COMPLETE").length}{" "}
            đơn vị chưa nộp đủ.
          </p>
          <textarea
            readOnly
            rows={12}
            value={assignments
              .filter((a) => a.report?.status !== "COMPLETE")
              .map(
                (a) =>
                  `${a.unit.code} — ${a.unit.name}: ${a.report ? `đã gửi tạm ${a.report.completed}/${a.report.required} ô` : "chưa nhận dữ liệu"}; hạn ${formatDate(a.dueAt || period!.dueAt)}${a.report?.reporterPhone ? `; liên hệ ${a.report.reporterName} ${a.report.reporterPhone}` : ""}`,
              )
              .join("\n")}
          />
          <div className="actions end">
            <button
              className="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `Đề nghị các đơn vị hoàn thành ${period?.title}:\n${assignments
                      .filter((a) => a.report?.status !== "COMPLETE")
                      .map(
                        (a) =>
                          `${a.unit.name} — hạn ${formatDate(a.dueAt || period!.dueAt)}`,
                      )
                      .join("\n")}`,
                  );
                  notify("Đã sao chép nội dung nhắc.");
                } catch {
                  notify(
                    "Trình duyệt chưa cho phép sao chép. Bạn có thể chọn nội dung trong ô.",
                  );
                }
              }}
            >
              Sao chép nội dung nhắc
            </button>
          </div>
        </Modal>
      )}
      {modal === "history" && (
        <Modal
          title="Các phiên bản báo cáo đã nhận"
          close={() => setModal("")}
          wide
        >
          {revisions.map((r) => (
            <details className="history-row" key={String(r.id)}>
              <summary>
                v{String(r.version)} ·{" "}
                {r.status === "COMPLETE" ? "Nộp đủ" : "Gửi tạm"} ·{" "}
                {formatDate(String(r.receivedAt))} · {String(r.reporterName)}
              </summary>
              <p>
                SĐT: {String(r.reporterPhone)} · Hạn lúc gửi:{" "}
                {formatDate(String(r.dueAt))}
              </p>
              <div className="review-table">
                {Object.entries(r.values as Record<string, number | null>).map(
                  ([k, v]) => (
                    <div key={k}>
                      <span>
                        {k} · {fields.find((f) => f.key === k)?.label}
                      </span>
                      <strong>{v ?? "Chưa nhập"}</strong>
                    </div>
                  ),
                )}
              </div>
              <pre>{JSON.stringify(r.notes, null, 2)}</pre>
            </details>
          ))}
        </Modal>
      )}
    </>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`badge ${value === "ON_TIME" ? "green" : value === "DRAFT" ? "blue" : value === "LATE" || value === "OVERDUE" ? "amber" : "neutral"}`}
    >
      <span className="status-dot" />
      {statusText[value]}
    </span>
  );
}
async function exportCredentials(rows: Credential[]) {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Tài khoản");
  sheet.addRow(["Mã đơn vị", "Tên đăng nhập", "Mật khẩu khởi tạo"]);
  rows.forEach((r) => sheet.addRow([r.code || "", r.username, r.password]));
  sheet.columns.forEach((c) => (c.width = 32));
  saveBlob(
    new Blob([new Uint8Array(await book.xlsx.writeBuffer())]),
    "credentials-don-vi.xlsx",
  );
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ImportUnits({
  manual,
  close,
  notify,
  onDone,
}: {
  manual: boolean;
  close: () => void;
  notify: (s: string) => void;
  onDone: (c: Credential[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<UnitRow[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [form, setForm] = useState<UnitRow>({
    code: "",
    name: "",
    group: "Đơn vị trực thuộc",
    parentCode: "",
    username: "",
    scope: "DIRECT",
  });
  const picker = useRef<HTMLInputElement>(null);
  async function template() {
    const ExcelJS = (await import("exceljs")).default;
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Đơn vị");
    sheet.addRow([
      "Mã đơn vị",
      "Tên đơn vị",
      "Nhóm đơn vị",
      "Mã cấp trên",
      "Tên đăng nhập",
      "Phạm vi số liệu",
    ]);
    sheet.addRow([
      "DV001",
      "Đơn vị mẫu",
      "Đơn vị trực thuộc",
      "",
      "",
      "DIRECT",
    ]);
    sheet.columns.forEach((c) => (c.width = 28));
    saveBlob(
      new Blob([new Uint8Array(await book.xlsx.writeBuffer())]),
      "mau-danh-sach-don-vi.xlsx",
    );
  }
  async function read(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024)
      return notify("Chọn file Excel dưới 5 MB.");
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      if (!sheet || sheet.rowCount > 2001)
        throw new Error("File cần 1–2.000 dòng dữ liệu.");
      const expected = [
        "Mã đơn vị",
        "Tên đơn vị",
        "Nhóm đơn vị",
        "Mã cấp trên",
        "Tên đăng nhập",
        "Phạm vi số liệu",
      ];
      if (
        !expected.every(
          (v, i) =>
            sheet
              .getRow(1)
              .getCell(i + 1)
              .text.trim() === v,
        )
      )
        throw new Error("Tiêu đề chưa đúng. Hãy dùng file mẫu.");
      const parsed: UnitRow[] = [],
        issues: string[] = [],
        codes = new Set<string>(),
        usernames = new Set<string>();
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const cells = expected.map((_, i) => row.getCell(i + 1));
        if (cells.some((c) => c.type === ExcelJS.ValueType.Formula)) {
          issues.push(`Dòng ${index}: không dùng công thức.`);
          return;
        }
        const vals = cells.map((c) => c.text.trim());
        if (!vals.some(Boolean)) return;
        const value = {
          code: vals[0],
          name: vals[1],
          group: vals[2] || "Đơn vị trực thuộc",
          parentCode: vals[3],
          username: vals[4],
          scope: vals[5] || "DIRECT",
        };
        const result = unitRowSchema.safeParse(value);
        if (!result.success) {
          issues.push(`Dòng ${index}: ${result.error.issues[0].message}`);
          return;
        }
        const username =
          result.data.username ||
          `${slug(result.data.name).slice(0, 50)}_${slug(result.data.code)}`;
        if (codes.has(value.code) || usernames.has(username)) {
          issues.push(`Dòng ${index}: trùng mã đơn vị hoặc tên đăng nhập.`);
          return;
        }
        codes.add(value.code);
        usernames.add(username);
        parsed.push(result.data);
      });
      setRows(parsed);
      setErrors(issues);
      if (!parsed.length && !issues.length)
        notify("File không có dòng dữ liệu.");
    } catch (e) {
      setRows([]);
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    let values = rows;
    if (manual) {
      const result = unitRowSchema.safeParse(form);
      if (!result.success) return notify(result.error.issues[0].message);
      values = [result.data];
    }
    if (!values.length || errors.length) return;
    setBusy(true);
    const credentials: Credential[] = [];
    // Parent records are imported first; API validates cycles and unknown parents again.
    const ordered: UnitRow[] = [],
      remaining = [...values],
      inFile = new Set(values.map((v) => v.code));
    while (remaining.length) {
      const index = remaining.findIndex(
        (r) =>
          !r.parentCode ||
          !inFile.has(r.parentCode) ||
          ordered.some((o) => o.code === r.parentCode),
      );
      if (index < 0) {
        setBusy(false);
        return notify("Quan hệ cấp trên có vòng lặp trong file.");
      }
      ordered.push(...remaining.splice(index, 1));
    }
    try {
      for (let i = 0; i < ordered.length; i += 20) {
        setProgress(
          `Đang xử lý ${i + 1}–${Math.min(i + 20, ordered.length)}/${ordered.length} đơn vị`,
        );
        const result = await api("/api/admin/units", {
          rows: ordered.slice(i, i + 20),
          batchId: crypto.randomUUID(),
        });
        credentials.push(...result.credentials);
      }
      notify(
        `Đã xử lý ${values.length} đơn vị. ${credentials.length} tài khoản mới được cấp.`,
      );
      await onDone(credentials);
    } catch (e) {
      if (credentials.length) {
        await exportCredentials(credentials);
      }
      notify(
        `${(e as Error).message} Các lô thành công đã được giữ. Nếu mất phản hồi của lô, kiểm tra danh sách và đặt lại mật khẩu tài khoản chưa nhận được.`,
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <Modal
      title={
        manual ? "Thêm hoặc cập nhật đơn vị" : "Nhập danh sách đơn vị từ Excel"
      }
      close={() => {
        if (!busy) close();
      }}
      wide={!manual}
    >
      {manual ? (
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Mã đơn vị
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </label>
            <label>
              Tên đơn vị
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Nhóm đơn vị
              <input
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
              />
            </label>
            <label>
              Mã cấp trên
              <input
                value={form.parentCode}
                onChange={(e) =>
                  setForm({ ...form, parentCode: e.target.value })
                }
              />
            </label>
            <label>
              Tên đăng nhập tùy chọn
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Tự sinh từ tên và mã đơn vị"
              />
            </label>
            <label>
              Phạm vi số liệu
              <select
                value={form.scope}
                onChange={(e) =>
                  setForm({
                    ...form,
                    scope: e.target.value as UnitRow["scope"],
                  })
                }
              >
                <option value="DIRECT">Chỉ số liệu của đơn vị</option>
                <option value="INCLUDES_CHILDREN">Đã bao gồm cấp dưới</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Nếu mã đã tồn tại, cập nhật thông tin và giữ tài khoản/mật khẩu cũ.
          </p>
          <div className="actions end">
            <button className="button" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu đơn vị và cấp tài khoản"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p>
            Tải file mẫu, điền danh sách và xem trước trước khi tạo tài khoản.
            Tài khoản cũ được giữ nguyên.
          </p>
          <div
            className="upload-zone"
            onClick={() => !busy && picker.current?.click()}
          >
            <FileSpreadsheet size={38} />
            <strong>Chọn file danh sách đơn vị</strong>
            <span>Định dạng .xlsx · tối đa 5 MB, 2.000 dòng</span>
            <input
              hidden
              ref={picker}
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                void read(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <button className="text-button" onClick={template}>
            <ArrowDownToLine size={15} />
            Tải file Excel mẫu
          </button>
          {errors.length > 0 && (
            <div className="alert warning">
              <div>
                <strong>{errors.length} lỗi cần sửa trước khi nhập</strong>
                {errors.slice(0, 15).map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            </div>
          )}
          {!!rows.length && (
            <div className="import-preview table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tên đơn vị</th>
                    <th>Nhóm</th>
                    <th>Tài khoản dự kiến</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r) => (
                    <tr key={r.code}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.group}</td>
                      <td>
                        {r.username ||
                          `${slug(r.name).slice(0, 50)}_${slug(r.code)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="actions end">
            <span className="muted">
              {progress ||
                `${rows.length} dòng hợp lệ${rows.length > 50 ? " · xem trước 50 dòng" : ""}`}
            </span>
            <button
              className="button"
              disabled={busy || !rows.length || !!errors.length}
              onClick={() => submit()}
            >
              {busy ? "Đang xử lý…" : "Xác nhận nhập và cấp tài khoản"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
function localValue(date: Date) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);
}
function iso(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}
function NewPeriod({
  units,
  close,
  notify,
  done,
}: {
  units: Unit[];
  close: () => void;
  notify: (s: string) => void;
  done: (id: string) => Promise<void>;
}) {
  const now = new Date();
  const [busy, setBusy] = useState(false),
    [ids, setIds] = useState(units.filter((u) => u.active).map((u) => u.id));
  const [form, setForm] = useState({
    title: "",
    kind: "WEEK",
    startAt: localValue(new Date(now.getTime() - 6 * 86400000)),
    endAt: localValue(now),
    opensAt: localValue(now),
    dueAt: localValue(new Date(now.getTime() + 2 * 86400000)),
    closesAt: localValue(new Date(now.getTime() + 3 * 86400000)),
  });
  const [repeat, setRepeat] = useState(1);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ids.length) return notify("Chọn ít nhất một đơn vị.");
    setBusy(true);
    let last = "";
    let created = 0;
    try {
      for (let i = 0; i < repeat; i++) {
        const shifted = (value: string) =>
          new Date(
            new Date(iso(value)).getTime() + i * 7 * 86400000,
          ).toISOString();
        const result = await api("/api/admin/periods", {
          ...form,
          title: repeat > 1 ? `${form.title} · ${i + 1}` : form.title,
          startAt: shifted(form.startAt),
          endAt: shifted(form.endAt),
          opensAt: shifted(form.opensAt),
          dueAt: shifted(form.dueAt),
          closesAt: shifted(form.closesAt),
          unitIds: ids,
        });
        last = result.period.id;
        created++;
      }
      notify(`Đã tạo ${created} kỳ báo cáo.`);
      await done(last);
    } catch (e) {
      notify(
        `${(e as Error).message}${created ? ` Đã tạo ${created} kỳ thành công; hãy kiểm tra trước khi tạo tiếp.` : ""}`,
      );
      if (created) await done(last);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Tạo kỳ báo cáo" close={() => !busy && close()} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Tên kỳ báo cáo
            <input
              required
              value={form.title}
              placeholder="Ví dụ: Báo cáo tuần 44/2026"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Loại kỳ
            <select
              value={form.kind}
              onChange={(e) => {
                setForm({ ...form, kind: e.target.value });
                setRepeat(1);
              }}
            >
              {Object.entries(kinds).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              { key: "startAt", label: "Bắt đầu khoảng số liệu" },
              { key: "endAt", label: "Kết thúc khoảng số liệu" },
              { key: "opensAt", label: "Mở cổng nhập" },
              { key: "dueAt", label: "Hạn nộp đúng giờ" },
              { key: "closesAt", label: "Khóa nhận báo cáo" },
            ] as const
          ).map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                type="datetime-local"
                required
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </label>
          ))}
          {form.kind === "WEEK" && (
            <label>
              Tạo trước các tuần tiếp theo
              <input
                type="number"
                min={1}
                max={12}
                value={repeat}
                onChange={(e) => setRepeat(Number(e.target.value))}
              />
              <small>Từ 1–12 kỳ; mỗi kỳ tiếp theo dịch đủ 7 ngày.</small>
            </label>
          )}
        </div>
        <div className="section-title">
          <h3>Đơn vị được giao ({ids.length})</h3>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setIds(
                ids.length === units.filter((u) => u.active).length
                  ? []
                  : units.filter((u) => u.active).map((u) => u.id),
              )
            }
          >
            Chọn / bỏ tất cả
          </button>
        </div>
        <div className="unit-checks">
          {units
            .filter((u) => u.active)
            .map((u) => (
              <label className="check-row" key={u.id}>
                <input
                  type="checkbox"
                  checked={ids.includes(u.id)}
                  onChange={(e) =>
                    setIds(
                      e.target.checked
                        ? [...ids, u.id]
                        : ids.filter((id) => id !== u.id),
                    )
                  }
                />
                {u.code} · {u.name}
              </label>
            ))}
          {!units.length && <p>Hãy tạo đơn vị trước khi tạo kỳ.</p>}
        </div>
        <p className="muted">
          Thời gian theo giờ Việt Nam. Sau hạn đúng giờ và trước khóa vẫn nhận,
          đánh dấu nộp muộn.
        </p>
        <div className="actions end">
          <button className="button" disabled={busy || !ids.length}>
            {busy ? "Đang tạo…" : "Tạo kỳ và giao báo cáo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Deadline({
  period,
  assignments,
  selected,
  close,
  notify,
  done,
}: {
  period: Period;
  assignments: Assignment[];
  selected: string[];
  close: () => void;
  notify: (s: string) => void;
  done: () => Promise<void>;
}) {
  const [scope, setScope] = useState(selected.length ? "selected" : "all"),
    [ids, setIds] = useState(selected),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    opensAt: localValue(new Date(period.opensAt)),
    dueAt: localValue(new Date(period.dueAt)),
    closesAt: localValue(new Date(period.closesAt)),
    reason: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (scope === "selected" && !ids.length)
      return notify("Chọn ít nhất một đơn vị.");
    setBusy(true);
    try {
      await api("/api/admin/deadlines", {
        periodId: period.id,
        unitIds: scope === "selected" ? ids : [],
        ...(scope === "all" ? { opensAt: iso(form.opensAt) } : {}),
        dueAt: iso(form.dueAt),
        closesAt: iso(form.closesAt),
        reason: form.reason,
      });
      notify("Đã cập nhật thời gian và lưu lịch sử.");
      await done();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Điều chỉnh thời gian nhập báo cáo"
      close={() => !busy && close()}
      wide
    >
      <p>{period.title}</p>
      <form onSubmit={submit}>
        <label>
          Phạm vi áp dụng
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">Thời gian chung của toàn kỳ</option>
            <option value="selected">Hạn riêng cho các đơn vị được chọn</option>
          </select>
        </label>
        {scope === "selected" && (
          <div className="unit-checks">
            {assignments.map((a) => (
              <label className="check-row" key={a.unitId}>
                <input
                  type="checkbox"
                  checked={ids.includes(a.unitId)}
                  onChange={(e) =>
                    setIds(
                      e.target.checked
                        ? [...ids, a.unitId]
                        : ids.filter((id) => id !== a.unitId),
                    )
                  }
                />
                {a.unit.code} · {a.unit.name}
              </label>
            ))}
          </div>
        )}
        <div className="form-grid">
          {(
            [
              { key: "opensAt", label: "Mở cổng nhập" },
              { key: "dueAt", label: "Hạn nộp đúng giờ" },
              { key: "closesAt", label: "Khóa nhận" },
            ] as const
          )
            .filter((f) => scope === "all" || f.key !== "opensAt")
            .map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type="datetime-local"
                  required
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: e.target.value })
                  }
                />
              </label>
            ))}
        </div>
        <label>
          Lý do thay đổi
          <textarea
            minLength={5}
            required
            maxLength={1000}
            rows={3}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Ví dụ: Gia hạn bổ sung số liệu theo yêu cầu…"
          />
        </label>
        <p className="muted">
          Đổi thời gian chung giữ nguyên hạn riêng đã cấp. Biên nhận cũ vẫn giữ
          hạn áp dụng tại lúc nhận.
        </p>
        <div className="actions end">
          <button className="button" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu điều chỉnh"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
