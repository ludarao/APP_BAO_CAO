"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  FileClock,
  Save,
  Send,
  AlertCircle,
  History,
  RotateCw,
} from "lucide-react";
import {
  applicableFields,
  canonicalValues,
  draftImportSchema,
  fields,
  FORM_VERSION,
  formatDate,
  formatDay,
  groups,
  inspectValues,
  initialValues,
  kinds,
  reportSchema,
  type Optional,
  type Values,
} from "@/lib/forms";
import { api, downloadJson, loadDraft, saveDraft } from "@/lib/client";
import { withRetry } from "@/lib/retry";
import type { Assignment, Bootstrap } from "@/lib/types";
import { Modal } from "./portal";
type Draft = {
  values: Values;
  optional: Optional;
  notes: { highlights: string; difficulties: string; progress: string };
  reporterName: string;
  reporterPhone: string;
  version: number;
  updatedAt?: string;
  pending?: { signature: string; key: string };
  formVersion: number;
  unitId: string;
  periodId: string;
};
export default function Reporter({
  data,
  tab,
  setTab,
  refresh,
  notify,
}: {
  data: Bootstrap;
  tab: string;
  setTab: (v: string) => void;
  refresh: () => Promise<void>;
  notify: (v: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const assignments = data.assignments || [];
  const active = assignments.find((a) => a.id === selected);
  if (active && tab === "reports")
    return (
      <Entry
        key={`${active.id}:${data.me.id}`}
        assignment={active}
        data={data}
        back={() => setSelected(null)}
        refresh={refresh}
        notify={notify}
      />
    );
  const completed = assignments.filter(
    (a) => a.report?.status === "COMPLETE",
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {data.me.unit?.code} · KHÔNG GIAN ĐƠN VỊ
          </div>
          <h1>
            {tab === "dashboard"
              ? "Báo cáo của đơn vị"
              : "Chọn kỳ để nhập báo cáo"}
          </h1>
          <p>{data.me.unit?.name}</p>
        </div>
        <button className="button secondary" onClick={() => refresh()}>
          <RotateCw size={16} />
          Làm mới
        </button>
      </div>
      <div className="stats three">
        <Stat
          label="Kỳ được giao"
          value={assignments.length}
          text="Theo danh sách phân công"
        />
        <Stat
          label="Đã nộp đủ"
          value={completed}
          text="Đã được máy chủ tiếp nhận"
          green
        />
        <Stat
          label="Cần hoàn thành"
          value={assignments.length - completed}
          text="Bao gồm chưa gửi và gửi tạm"
        />
      </div>
      <div className="section-title">
        <h2>Các kỳ báo cáo</h2>
        <span>{assignments.length} kỳ gần nhất</span>
      </div>
      {!assignments.length && (
        <div className="empty card">
          <ClipboardList size={34} />
          <h3>Chưa có kỳ được giao</h3>
          <p>Quản trị viên sẽ mở kỳ và phân công đơn vị báo cáo.</p>
        </div>
      )}
      <div className="period-grid">
        {assignments.map((a) => {
          const p = a.period,
            due = a.dueAt || p.dueAt;
          const open =
            new Date() >= new Date(p.opensAt) &&
            new Date() <= new Date(a.closesAt || p.closesAt);
          return (
            <article className="card period-card" key={a.id}>
              <div className="row-between">
                <span className="kind-badge">
                  BÁO CÁO {kinds[p.kind].toUpperCase()}
                </span>
                <span
                  className={`badge ${a.report?.status === "COMPLETE" ? "green" : open ? "blue" : "neutral"}`}
                >
                  {a.report?.status === "COMPLETE"
                    ? "Đã nộp đủ"
                    : a.report
                      ? "Đã gửi tạm"
                      : open
                        ? "Đang mở"
                        : "Chưa mở / Đã khóa"}
                </span>
              </div>
              <h3>{p.title}</h3>
              <p className="muted">
                Số liệu: {formatDay(p.startAt)} — {formatDay(p.endAt)}
              </p>
              <div className="period-deadline">
                <FileClock size={16} />
                <span>
                  Hạn nộp <strong>{formatDate(due)}</strong>
                </span>
              </div>
              {a.report && (
                <div className="mini-progress">
                  <div>
                    <span>
                      Máy chủ đã nhận {a.report.completed}/{a.report.required} ô
                    </span>
                    <strong>v{a.report.version}</strong>
                  </div>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${(a.report.completed / a.report.required) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <button
                className="button secondary full"
                onClick={() => {
                  setSelected(a.id);
                  setTab("reports");
                }}
              >
                {a.report ? "Xem và cập nhật báo cáo" : "Mở biểu nhập liệu"}
                <ArrowRight size={16} />
              </button>
            </article>
          );
        })}
      </div>
      <div className="info-strip">
        <Save size={20} />
        <div>
          <strong>Bản nháp được lưu trên thiết bị</strong>
          <p>
            Chỉ khi nhận biên nhận sau khi gửi, báo cáo mới được ghi nhận trên
            hệ thống.
          </p>
        </div>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  text,
  green = false,
}: {
  label: string;
  value: number;
  text: string;
  green?: boolean;
}) {
  return (
    <div className="card stat-card">
      <span>{label}</span>
      <strong className={green ? "text-green" : ""}>
        {value.toString().padStart(2, "0")}
      </strong>
      <small>{text}</small>
    </div>
  );
}
function Entry({
  assignment: a,
  data,
  back,
  refresh,
  notify,
}: {
  assignment: Assignment;
  data: Bootstrap;
  back: () => void;
  refresh: () => Promise<void>;
  notify: (v: string) => void;
}) {
  const p = a.period;
  const key = `${data.me.id}:${a.unitId}:${p.id}:v${FORM_VERSION}`;
  function initial(): Draft {
    return {
      values: initialValues(
        p.kind,
        a.report?.optional || { training: null, staffing: null },
        a.report?.values || {},
      ),
      optional: a.report?.optional || { training: null, staffing: null },
      notes: a.report?.notes || {
        highlights: "",
        difficulties: "",
        progress: "",
      },
      reporterName: a.report?.reporterName || "",
      reporterPhone: a.report?.reporterPhone || "",
      version: a.report?.version || 0,
      formVersion: FORM_VERSION,
      unitId: a.unitId,
      periodId: p.id,
    };
  }
  const [draft, setDraft] = useState<Draft>(initial),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(""),
    [group, setGroup] = useState(0),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<{
      id: string;
      version: number;
      receivedAt: string;
      status: string;
    } | null>(null),
    [showHistory, setShowHistory] = useState(false),
    [history, setHistory] = useState<Record<string, unknown>[]>([]),
    [conflict, setConflict] = useState(false);
  const latest = useRef(draft),
    importer = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    loadDraft<Draft>(key)
      .then((saved) => {
        if (!alive) return;
        if (
          saved &&
          saved.formVersion === FORM_VERSION &&
          saved.unitId === a.unitId &&
          saved.periodId === p.id
        ) {
          setDraft({
            ...saved,
            values: initialValues(p.kind, saved.optional, saved.values),
          });
          if (saved.version !== (a.report?.version || 0)) setConflict(true);
        }
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setReady(true);
          notify(
            "Trình duyệt không cho lưu nháp. Hãy tải bản nháp ra file để dự phòng.",
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [key, a.unitId, p.id, a.report?.version, notify]);
  useEffect(() => {
    latest.current = draft;
    if (!ready) return;
    setSaving("Đang lưu nháp…");
    const timer = setTimeout(() => {
      saveDraft(key, { ...draft, updatedAt: new Date().toISOString() })
        .then(() => setSaving("Đã lưu trên thiết bị"))
        .catch(() => setSaving("Chưa lưu được · hãy tải nháp"));
    }, 600);
    return () => clearTimeout(timer);
  }, [draft, ready, key]);
  useEffect(() => {
    const flush = () => {
      void saveDraft(key, latest.current);
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (saving === "Đang lưu nháp…") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", warn);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", warn);
      void saveDraft(key, latest.current);
    };
  }, [key, saving]);
  const applicable = applicableFields(p.kind, draft.optional),
    visibleGroups = groups.filter((g) =>
      applicable.some((f) => f.group === g.id),
    );
  const currentGroup = visibleGroups[Math.min(group, visibleGroups.length - 1)];
  const check = inspectValues(
    p.kind,
    canonicalValues(p.kind, draft.values, draft.optional),
    draft.optional,
  );
  const change = (patch: Partial<Draft>) => {
    setDraft((d) => ({
      ...d,
      ...patch,
      ...(patch.optional
        ? {
            values: initialValues(
              p.kind,
              patch.optional,
              patch.values || d.values,
            ),
          }
        : {}),
      pending: undefined,
    }));
    setReceipt(null);
  };
  async function importDraft(file?: File) {
    if (!file) return;
    if (file.size > 256 * 1024) return notify("File nháp quá lớn.");
    try {
      const value = JSON.parse(await file.text());
      if (
        value.unitId !== a.unitId ||
        value.periodId !== p.id ||
        value.formVersion !== FORM_VERSION
      )
        throw new Error("File không thuộc đơn vị, kỳ hoặc phiên bản biểu này.");
      const parsed = draftImportSchema.parse(value);
      change({
        ...parsed,
        values: initialValues(p.kind, parsed.optional, parsed.values),
        unitId: a.unitId,
        pending: undefined,
      });
      notify("Đã khôi phục bản nháp. Hãy rà soát trước khi gửi.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function submit(intent: "DRAFT" | "COMPLETE") {
    if (busy) return;
    setBusy(true);
    try {
      const payload = {
        periodId: p.id,
        formVersion: FORM_VERSION,
        version: draft.version,
        intent,
        values: canonicalValues(p.kind, draft.values, draft.optional),
        optional: draft.optional,
        notes: draft.notes,
        reporterName: draft.reporterName,
        reporterPhone: draft.reporterPhone,
      };
      const signature = JSON.stringify(payload);
      const idempotencyKey =
        draft.pending?.signature === signature
          ? draft.pending.key
          : crypto.randomUUID();
      const pendingDraft = {
        ...draft,
        pending: { signature, key: idempotencyKey },
      };
      await saveDraft(key, pendingDraft);
      setDraft(pendingDraft);
      reportSchema.parse({ ...payload, idempotencyKey });
      const result = await withRetry(() =>
        api("/api/reports", { ...payload, idempotencyKey }),
      );
      const saved = {
        ...pendingDraft,
        version: result.receipt.version,
        pending: undefined,
      };
      await saveDraft(key, saved);
      setDraft(saved);
      setReceipt(result.receipt);
      setConflict(false);
      setReview(false);
      notify(
        intent === "COMPLETE"
          ? "Máy chủ đã nhận báo cáo đầy đủ."
          : "Máy chủ đã nhận bản gửi tạm. Báo cáo chưa được tính là nộp đủ.",
      );
    } catch (e) {
      if ((e as { status?: number }).status === 409) setConflict(true);
      notify(
        (e as Error).message.startsWith("[")
          ? "Hãy kiểm tra tên, số điện thoại và dữ liệu trước khi gửi."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadServer() {
    try {
      const fresh = await api("/api/bootstrap");
      const server = fresh.assignments.find(
        (x: Assignment) => x.id === a.id,
      )?.report;
      downloadJson(`nhap-truoc-doi-chieu-${p.id}.json`, draft);
      if (server) {
        const next = {
          ...initial(),
          ...{
            values: initialValues(p.kind, server.optional, server.values),
            optional: server.optional,
            notes: server.notes,
            reporterName: server.reporterName,
            reporterPhone: server.reporterPhone,
            version: server.version,
          },
        };
        await saveDraft(key, next);
        setDraft(next);
      } else {
        setDraft(initial());
      }
      setConflict(false);
      notify(
        "Đã mở bản máy chủ. Bản nháp trước đó được tải xuống để bạn đối chiếu.",
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function getHistory() {
    setShowHistory(true);
    if (!a.report?.id) return;
    try {
      const result = await api(`/api/admin/history?reportId=${a.report.id}`);
      setHistory(result.revisions);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (!ready) return <div className="empty">Đang khôi phục bản nháp…</div>;
  return (
    <>
      <button
        className="back-link"
        onClick={async () => {
          await saveDraft(key, draft);
          await refresh();
          back();
        }}
      >
        <ArrowLeft size={16} />
        Các kỳ báo cáo
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">BÁO CÁO {kinds[p.kind].toUpperCase()}</div>
          <h1>{p.title}</h1>
          <p>
            {data.me.unit?.name}{" "}
            <span className="muted">
              · Hạn nộp {formatDate(a.dueAt || p.dueAt)}
            </span>
          </p>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => downloadJson(`ban-nhap-${p.id}.json`, draft)}
          >
            <ArrowDownToLine size={16} />
            Tải nháp
          </button>
          <button
            className="button secondary"
            onClick={() => importer.current?.click()}
          >
            Khôi phục nháp
          </button>
          <input
            ref={importer}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              void importDraft(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {conflict && (
        <div className="alert warning">
          <AlertCircle size={18} />
          <span>
            Bản nháp có phiên bản khác máy chủ. Cần đối chiếu trước khi gửi.
          </span>
          <button className="button secondary small" onClick={loadServer}>
            Tải bản máy chủ
          </button>
        </div>
      )}
      {receipt && (
        <div className="alert success">
          <CheckCircle2 size={20} />
          <div>
            <strong>
              Máy chủ đã nhận{" "}
              {receipt.status === "COMPLETE" ? "báo cáo đầy đủ" : "bản gửi tạm"}
            </strong>
            <p>
              Biên nhận {receipt.id} · v{receipt.version} ·{" "}
              {formatDate(receipt.receivedAt)}
            </p>
          </div>
        </div>
      )}
      <div className="entry-layout">
        <aside className="entry-navigation card">
          <div className="entry-progress">
            <span>TIẾN ĐỘ NHẬP LIỆU</span>
            <strong>
              {check.completed}
              <small> / {check.required} ô</small>
            </strong>
            <div className="progress-track">
              <span
                style={{
                  width: `${(check.completed / check.required) * 100}%`,
                }}
              />
            </div>
          </div>
          {visibleGroups.map((g, i) => {
            const fs = applicable.filter((f) => f.group === g.id);
            const done = fs.filter((f) => draft.values[f.key] != null).length;
            return (
              <button
                className={`group-button ${group === i ? "active" : ""}`}
                key={g.id}
                onClick={() => setGroup(i)}
              >
                <span
                  className={`group-number ${done === fs.length ? "done" : ""}`}
                >
                  {done === fs.length ? <Check size={14} /> : g.id}
                </span>
                <span>
                  {g.name}
                  <small>
                    {done}/{fs.length} ô số liệu
                  </small>
                </span>
              </button>
            );
          })}
          <div className="entry-save">
            <Save size={15} />
            {saving}
          </div>
        </aside>
        <section className="entry-content">
          {p.kind === "MONTH" && (
            <div className="card optional-card">
              <h3>Nội dung bổ sung trong tháng</h3>
              <p>
                Chọn rõ có phát sinh hoặc thay đổi để mở phần nhập tương ứng.
              </p>
              {(
                [
                  {
                    key: "training",
                    label: "Nhóm tập huấn, hội thi và hoạt động có phát sinh?",
                  },
                  {
                    key: "staffing",
                    label: "Số cán bộ kiểm tra bán chuyên trách có thay đổi?",
                  },
                ] as const
              ).map((item) => (
                <div className="optional-row" key={item.key}>
                  <span>{item.label}</span>
                  <div className="segmented">
                    <button
                      className={
                        draft.optional[item.key] === true ? "selected" : ""
                      }
                      onClick={() =>
                        change({
                          optional: { ...draft.optional, [item.key]: true },
                        })
                      }
                    >
                      Có
                    </button>
                    <button
                      className={
                        draft.optional[item.key] === false ? "selected" : ""
                      }
                      onClick={() => {
                        const optional = {
                          ...draft.optional,
                          [item.key]: false,
                        };
                        change({
                          optional,
                          values: canonicalValues(
                            p.kind,
                            draft.values,
                            optional,
                          ),
                        });
                      }}
                    >
                      Không
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="card field-card">
            <div className="field-card-heading">
              <div>
                <div className="eyebrow">NHÓM {currentGroup.id}</div>
                <h2>{currentGroup.name}</h2>
                <p>{currentGroup.description}</p>
              </div>
              <button
                className="button secondary small"
                onClick={() => {
                  const zero = Object.fromEntries(
                    applicable
                      .filter(
                        (f) =>
                          f.group === currentGroup.id &&
                          f.aggregation === "sum" &&
                          draft.values[f.key] == null,
                      )
                      .map((f) => [f.key, 0]),
                  );
                  change({ values: { ...draft.values, ...zero } });
                }}
              >
                Không phát sinh ở các ô đếm
              </button>
            </div>
            <div className="field-table-heading">
              <span>CHỈ TIÊU BÁO CÁO</span>
              <span>SỐ LIỆU</span>
            </div>
            {applicable
              .filter((f) => f.group === currentGroup.id)
              .map((f) => (
                <div
                  className={`field-row ${check.errors[f.key] ? "invalid" : ""}`}
                  key={f.key}
                >
                  <div>
                    <label htmlFor={`f-${f.key}`}>
                      <span className="field-code">
                        {f.key.replace("_", ".")}
                      </span>
                      {f.label}
                    </label>
                    <small>
                      {f.unit}
                      {f.aggregation === "snapshot"
                        ? " · Số tại thời điểm báo cáo"
                        : ""}
                      {f.key === "25_3"
                        ? " · Nhập tổng đã loại người trùng giữa hai loại"
                        : ""}
                    </small>
                    {check.errors[f.key] && (
                      <span className="field-error">{check.errors[f.key]}</span>
                    )}
                  </div>
                  <input
                    id={`f-${f.key}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100000000"
                    step="1"
                    placeholder="0"
                    value={draft.values[f.key] ?? ""}
                    onChange={(e) =>
                      change({
                        values: {
                          ...draft.values,
                          [f.key]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={() => {
                      if (draft.values[f.key] == null)
                        change({ values: { ...draft.values, [f.key]: 0 } });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const inputs = Array.from(
                          document.querySelectorAll<HTMLInputElement>(
                            ".field-row input",
                          ),
                        );
                        inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
                      }
                    }}
                  />
                </div>
              ))}
            <div className="field-footer">
              <span>Các ô mặc định là 0. Chọn ô và nhập số để thay thế.</span>
              <div className="actions">
                <button
                  className="button secondary small"
                  disabled={group === 0}
                  onClick={() => setGroup((g) => g - 1)}
                >
                  <ArrowLeft size={15} />
                  Trước
                </button>
                <button
                  className="button secondary small"
                  disabled={group >= visibleGroups.length - 1}
                  onClick={() => setGroup((g) => g + 1)}
                >
                  Tiếp
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
          <div className="card notes-card">
            <h2>Nhận xét và kiến nghị</h2>
            {(
              [
                { key: "highlights", label: "Hoạt động nổi bật" },
                { key: "difficulties", label: "Khó khăn, kiến nghị" },
                ...(p.kind === "WEEK" || p.kind === "MONTH"
                  ? []
                  : [
                      {
                        key: "progress" as const,
                        label:
                          "Tiến độ nhiệm vụ và đánh giá so với kỳ đối chiếu",
                      },
                    ]),
              ] as { key: keyof Draft["notes"]; label: string }[]
            ).map((n) => (
              <label key={n.key}>
                {n.label}
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={draft.notes[n.key]}
                  onChange={(e) =>
                    change({
                      notes: { ...draft.notes, [n.key]: e.target.value },
                    })
                  }
                  placeholder="Nhập nội dung nếu có…"
                />
              </label>
            ))}
          </div>
          <div className="card contact-card">
            <h2>Thông tin người nhập</h2>
            <p>Bắt buộc xác nhận mỗi lần gửi báo cáo.</p>
            {!!data.contacts?.length && (
              <label>
                Chọn người đã lưu
                <select
                  value=""
                  onChange={(e) => {
                    const contact = data.contacts?.find(
                      (c) => c.phone === e.target.value,
                    );
                    if (contact)
                      change({
                        reporterName: contact.name,
                        reporterPhone: contact.phone,
                      });
                  }}
                >
                  <option value="">Chọn nhanh thông tin…</option>
                  {data.contacts.map((c) => (
                    <option key={c.phone} value={c.phone}>
                      {c.name} · {c.phone}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="form-grid">
              <label>
                Họ và tên
                <input
                  autoComplete="name"
                  value={draft.reporterName}
                  maxLength={120}
                  onChange={(e) => change({ reporterName: e.target.value })}
                  placeholder="Họ tên người nhập"
                />
              </label>
              <label>
                Số điện thoại
                <input
                  type="tel"
                  autoComplete="tel"
                  value={draft.reporterPhone}
                  onChange={(e) => change({ reporterPhone: e.target.value })}
                  placeholder="09xxxxxxxx"
                />
              </label>
            </div>
          </div>
          <div className="submit-bar">
            <div>
              <strong>
                {check.completed}/{check.required} ô đã nhập
              </strong>
              <small>
                <Save size={13} />
                {saving}
              </small>
            </div>
            <div className="actions">
              <button
                className="icon-button"
                title="Lịch sử gửi"
                aria-label="Lịch sử gửi"
                onClick={getHistory}
              >
                <History size={19} />
              </button>
              <button
                className="button secondary"
                disabled={busy || conflict}
                onClick={() => submit("DRAFT")}
              >
                <CloudUpload size={17} />
                Gửi tạm
              </button>
              <button
                className="button"
                onClick={() => setReview(true)}
                disabled={busy || conflict}
              >
                Rà soát và gửi
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </section>
      </div>
      {review && (
        <Modal
          title="Rà soát báo cáo trước khi gửi"
          close={() => setReview(false)}
          wide
        >
          <p>
            {p.title} · {draft.reporterName || "Chưa có tên người nhập"} ·{" "}
            {draft.reporterPhone || "Chưa có số điện thoại"}
          </p>
          {!check.complete && (
            <div className="alert warning">
              <AlertCircle size={18} />
              <span>
                Còn {check.missing.length} ô chưa nhập
                {check.confirmationsMissing
                  ? "; chưa xác nhận phần bổ sung tháng"
                  : ""}
                {Object.keys(check.errors).length ? "; có số liệu cần sửa" : ""}
                .
              </span>
            </div>
          )}
          <div className="review-table">
            {applicable.map((f) => (
              <div key={f.key}>
                <span>
                  {f.key.replace("_", ".")} · {f.label}
                </span>
                <strong
                  className={draft.values[f.key] == null ? "text-amber" : ""}
                >
                  {draft.values[f.key] ?? "Chưa nhập"}
                </strong>
              </div>
            ))}
          </div>
          <p className="muted">
            Hệ thống ghi nhận thời gian máy chủ nhận được báo cáo. Soạn trước
            hạn nhưng gửi sau hạn vẫn có thể được ghi nhận muộn.
          </p>
          <div className="actions end">
            <button
              className="button secondary"
              onClick={() => setReview(false)}
            >
              Quay lại chỉnh sửa
            </button>
            <button
              className="button"
              disabled={busy || !check.complete}
              onClick={() => submit("COMPLETE")}
            >
              <Send size={17} />
              {busy ? "Đang gửi…" : "Xác nhận gửi báo cáo"}
            </button>
          </div>
        </Modal>
      )}
      {showHistory && (
        <Modal
          title="Lịch sử gửi báo cáo"
          close={() => setShowHistory(false)}
          wide
        >
          {!history.length ? (
            <p>
              Chưa có phiên bản được tải. Lịch sử mới hiển thị sau khi tải lại
              dữ liệu kỳ.
            </p>
          ) : (
            history.map((r) => (
              <details className="history-row" key={String(r.id)}>
                <summary>
                  Phiên bản {String(r.version)} ·{" "}
                  {r.status === "COMPLETE" ? "Nộp đủ" : "Gửi tạm"} ·{" "}
                  {formatDate(String(r.receivedAt))} · {String(r.reporterName)}
                </summary>
                <p>
                  {String(r.reporterPhone)} · Hạn lúc nhận:{" "}
                  {formatDate(String(r.dueAt))}
                </p>
                <div className="review-table">
                  {Object.entries(r.values as Values).map(([key, value]) => (
                    <div key={key}>
                      <span>
                        {fields.find((f) => f.key === key)?.label || key}
                      </span>
                      <strong>{value ?? "Chưa nhập"}</strong>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </Modal>
      )}
    </>
  );
}
