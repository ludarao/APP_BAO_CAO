"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  Building2,
  RotateCw,
  Search,
} from "lucide-react";
import { api } from "@/lib/client";
import { formatDate, formatDay, groups, type fields } from "@/lib/forms";
import type { Bootstrap } from "@/lib/types";
type Metric = (typeof fields)[number] & {
  value: number | null;
  contributors: number;
  expected: number;
  missing: number;
  conditional: boolean;
};
interface Summary {
  period: { id: string; title: string; startAt: string; endAt: string };
  units: { id: string; code: string; name: string }[];
  stats: { assigned: number; complete: number; draft: number; empty: number };
  metrics: Metric[];
  sources: string[];
  excluded: string[];
  expectedSources: number;
  refreshedAt: string;
  detail: null | {
    unit: { name: string; code: string };
    dueAt: string;
    report: null | {
      status: string;
      reporterName: string;
      reporterPhone: string;
      updatedAt: string;
      notes: Record<string, string>;
    };
  };
}
export default function Analytics({
  data,
  notify,
}: {
  data: Bootstrap;
  notify: (message: string) => void;
}) {
  const [periodId, setPeriod] = useState(data.selectedId || "");
  const [unitId, setUnit] = useState(""),
    [drafts, setDrafts] = useState(false),
    [search, setSearch] = useState(""),
    [group, setGroup] = useState(""),
    [result, setResult] = useState<Summary | null>(null),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!periodId) return;
    let alive = true;
    setLoading(true);
    api(
      `/api/admin/analytics?periodId=${encodeURIComponent(periodId)}&unitId=${encodeURIComponent(unitId)}&drafts=${drafts}`,
    )
      .then((value) => {
        if (alive) setResult(value);
      })
      .catch((e) => {
        if (alive) {
          setResult(null);
          notify(e.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodId, unitId, drafts, revision, notify]);
  const visible =
    result?.metrics.filter(
      (f) =>
        (!group || f.group === Number(group)) &&
        (!search ||
          `${f.key} ${f.label}`
            .toLocaleLowerCase("vi")
            .includes(search.toLocaleLowerCase("vi"))),
    ) || [];
  const highlights = ["01", "23", "26", "31", "39", "45"]
    .map((key) => result?.metrics.find((f) => f.key === key))
    .filter((f): f is Metric => !!f);
  const number = (v: number | null) =>
    v == null ? "Chưa có số liệu" : v.toLocaleString("vi-VN");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SỐ LIỆU ĐÃ NHẬP</div>
          <h1>
            {unitId ? "Số liệu của đơn vị" : "Dashboard số liệu tổng hợp"}
          </h1>
          <p>
            Xem đầy đủ các chỉ tiêu trong một kỳ, theo toàn bộ đơn vị hoặc từng
            đơn vị.
          </p>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => setRevision((v) => v + 1)}
            disabled={loading}
          >
            <RotateCw size={16} />
            Làm mới
          </button>
          {periodId && (
            <a
              className="button"
              href={`/api/admin/export?periodId=${periodId}&unitId=${encodeURIComponent(unitId)}&drafts=${drafts}`}
            >
              <ArrowDownToLine size={16} />
              Xuất Excel theo bộ lọc
            </a>
          )}
        </div>
      </div>
      <section className="card analytics-filters">
        <label>
          Kỳ báo cáo
          <select
            value={periodId}
            onChange={(e) => {
              setUnit("");
              setPeriod(e.target.value);
            }}
          >
            <option value="" disabled>
              Chưa có kỳ
            </option>
            {data.periods?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Đơn vị
          <select
            disabled={loading || !result}
            value={unitId}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Tất cả đơn vị trong kỳ</option>
            {(result?.units || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={drafts}
            onChange={(e) => setDrafts(e.target.checked)}
          />
          Bao gồm bản gửi tạm
        </label>
      </section>
      {!periodId ? (
        <div className="card empty">
          <BarChart3 size={32} />
          <h3>Chưa có kỳ báo cáo</h3>
          <p>Tạo hoặc thiết lập lịch tự động trong mục Kỳ báo cáo.</p>
        </div>
      ) : loading ? (
        <div className="card empty" role="status">
          Đang tổng hợp số liệu…
        </div>
      ) : (
        result && (
          <>
            <div className="analytics-scope">
              <span>
                <strong>
                  {unitId
                    ? result.detail?.unit.name
                    : `${result.stats.assigned} đơn vị được giao`}
                </strong>{" "}
                · {formatDay(result.period.startAt)} —{" "}
                {formatDay(result.period.endAt)}
              </span>
              <span className={`badge ${drafts ? "amber" : "green"}`}>
                {drafts ? "Gồm cả bản gửi tạm" : "Chỉ bản đã nộp đủ"}
              </span>
            </div>
            <div className="stats five">
              {[
                { label: "Đơn vị được chọn", value: result.stats.assigned },
                { label: "Đã nộp đủ", value: result.stats.complete },
                { label: "Đã gửi tạm", value: result.stats.draft },
                { label: "Chưa gửi", value: result.stats.empty },
                { label: "Nguồn tính tổng", value: result.sources.length },
              ].map((s) => (
                <div className="card stat-card" key={s.label}>
                  <span>{s.label}</span>
                  <strong>{s.value}</strong>
                </div>
              ))}
            </div>
            <div className="indicator-highlights">
              {highlights.map((f) => (
                <article className="card indicator-card" key={f.key}>
                  <span className="field-code">{f.code}</span>
                  <h3>{f.label}</h3>
                  <strong>{number(f.value)}</strong>
                  <small>
                    {f.unit} · {f.contributors}/{f.expected} nguồn có số liệu
                  </small>
                </article>
              ))}
            </div>
            {!!result.excluded.length && (
              <div className="alert">
                Đã loại {result.excluded.join(", ")} khỏi tổng vì số liệu đã nằm
                trong đơn vị cấp trên. Chọn riêng đơn vị để xem số của đơn vị
                đó.
              </div>
            )}
            {result.detail && (
              <section className="card analytics-detail">
                <h2>
                  <Building2 size={19} /> {result.detail.unit.name}
                </h2>
                {result.detail.report ? (
                  <>
                    <div className="form-grid">
                      <p>
                        Trạng thái:{" "}
                        <strong>
                          {result.detail.report.status === "COMPLETE"
                            ? "Đã nộp đủ"
                            : "Gửi tạm"}
                        </strong>
                        <br />
                        Cập nhật: {formatDate(result.detail.report.updatedAt)}
                      </p>
                      <p>
                        Người nhập:{" "}
                        <strong>{result.detail.report.reporterName}</strong>
                        <br />
                        Điện thoại: {result.detail.report.reporterPhone}
                        <br />
                        Hạn nộp: {formatDate(result.detail.dueAt)}
                      </p>
                    </div>
                    {result.detail.report.status === "DRAFT" && !drafts && (
                      <p className="text-amber">
                        Bật “Bao gồm bản gửi tạm” để xem các số đã nhập của bản
                        này.
                      </p>
                    )}
                    <details>
                      <summary>Nhận xét, hoạt động và kiến nghị</summary>
                      {Object.entries(result.detail.report.notes || {}).map(
                        ([key, value]) => (
                          <p key={key}>
                            <strong>
                              {(
                                {
                                  highlights: "Hoạt động nổi bật",
                                  difficulties: "Khó khăn, kiến nghị",
                                  progress: "Tiến độ, đánh giá",
                                } as Record<string, string>
                              )[key] || key}
                              :
                            </strong>{" "}
                            {value || "Không có nội dung"}
                          </p>
                        ),
                      )}
                    </details>
                  </>
                ) : (
                  <p>Đơn vị chưa gửi dữ liệu trong kỳ này.</p>
                )}
              </section>
            )}
            <section className="card analytics-table">
              <div className="table-title">
                <div>
                  <h2>Đầy đủ chỉ tiêu báo cáo</h2>
                  <p>
                    {visible.length}/{result.metrics.length} chỉ tiêu · Cập nhật{" "}
                    {formatDate(result.refreshedAt)}
                  </p>
                </div>
              </div>
              <div className="table-filters">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Tìm chỉ tiêu"
                    placeholder="Tìm mã hoặc nội dung chỉ tiêu…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Lọc nhóm chỉ tiêu"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option value="">Tất cả nhóm chỉ tiêu</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      Nhóm {g.id} · {g.name}
                    </option>
                  ))}
                </select>
              </div>
              {groups
                .filter((g) => visible.some((f) => f.group === g.id))
                .map((g) => (
                  <section className="metric-group" key={g.id}>
                    <h3>
                      Nhóm {g.id} · {g.name}
                    </h3>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>MÃ</th>
                            <th>NỘI DUNG</th>
                            <th>ĐƠN VỊ TÍNH</th>
                            <th>{unitId ? "SỐ LIỆU" : "TỔNG SỐ"}</th>
                            <th>NGUỒN SỐ LIỆU</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible
                            .filter((f) => f.group === g.id)
                            .map((f) => (
                              <tr key={f.key}>
                                <td>
                                  <code>{f.key.replace("_", ".")}</code>
                                </td>
                                <td>
                                  {f.label}
                                  {f.conditional && (
                                    <small>Chỉ khi có phát sinh/thay đổi</small>
                                  )}
                                </td>
                                <td>{f.unit}</td>
                                <td className="metric-value">
                                  {number(f.value)}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${f.missing ? "amber" : "neutral"}`}
                                  >
                                    {f.contributors}/{f.expected} nguồn
                                  </span>
                                  {!!f.missing && (
                                    <small>Còn thiếu {f.missing} nguồn</small>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              {!visible.length && (
                <div className="empty">Không có chỉ tiêu phù hợp bộ lọc.</div>
              )}
              <div className="table-footer">
                Ô chưa có dữ liệu được giữ riêng với số 0. Không cộng số của các
                kỳ thời gian khác nhau.
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
