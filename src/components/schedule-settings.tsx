"use client";
import { useEffect, useState } from "react";
import { CalendarClock, Save } from "lucide-react";
import { api } from "@/lib/client";
import { kinds, type Kind } from "@/lib/forms";
import type { ScheduleRule } from "@/lib/schedule-calendar";
export default function ScheduleSettings({
  notify,
  done,
}: {
  notify: (message: string) => void;
  done: () => Promise<void>;
}) {
  const [rules, setRules] = useState<ScheduleRule[]>([]),
    [kind, setKind] = useState<Kind>("WEEK"),
    [busy, setBusy] = useState(false),
    [applyOpen, setApplyOpen] = useState(false);
  useEffect(() => {
    api("/api/admin/schedules")
      .then((r) => setRules(r.schedules))
      .catch((e) => notify(e.message));
  }, [notify]);
  const rule = rules.find((r) => r.kind === kind);
  const update = (patch: Partial<ScheduleRule>) =>
    setRules((rows) =>
      rows.map((r) => (r.kind === kind ? { ...r, ...patch } : r)),
    );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!rule) return;
    setBusy(true);
    try {
      const result = await api("/api/admin/schedules", {
        schedule: rule,
        applyToOpen: applyOpen,
      });
      notify(
        `Đã lưu lịch mặc định. Tạo ${result.created} kỳ mới, cập nhật ${result.updated} kỳ.${result.skipped ? ` Giữ nguyên ${result.skipped} kỳ do xung đột với hạn riêng của đơn vị.` : ""}`,
      );
      await done();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card schedule-settings">
      <div className="section-heading">
        <span className="section-icon">
          <CalendarClock size={22} />
        </span>
        <div>
          <h2>Lịch báo cáo tự động</h2>
          <p>
            Chuẩn bị trước 12 tháng. Cổng tự mở và khóa theo giờ Việt Nam, không
            cần admin bật thủ công.
          </p>
        </div>
      </div>
      <div className="schedule-tabs">
        {Object.entries(kinds).map(([id, label]) => (
          <button
            className={kind === id ? "selected" : ""}
            key={id}
            onClick={() => {
              setKind(id as Kind);
              setApplyOpen(false);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {!rule ? (
        <p>Đang tải lịch mặc định…</p>
      ) : (
        <form onSubmit={save}>
          <div className="form-grid">
            <label>
              {kind === "WEEK"
                ? "Ngày mở để báo cáo tuần trước"
                : "Ngày mở trong tháng đầu kỳ kế tiếp"}
              {kind === "WEEK" ? (
                <select
                  value={rule.openingDay}
                  onChange={(e) =>
                    update({ openingDay: Number(e.target.value) })
                  }
                >
                  {[
                    "Thứ Hai",
                    "Thứ Ba",
                    "Thứ Tư",
                    "Thứ Năm",
                    "Thứ Sáu",
                    "Thứ Bảy",
                    "Chủ nhật",
                  ].map((day, i) => (
                    <option key={day} value={i + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={rule.openingDay}
                  onChange={(e) =>
                    update({ openingDay: Number(e.target.value) })
                  }
                />
              )}
            </label>
            <label>
              Giờ mở cổng
              <input
                type="time"
                required
                value={rule.opensTime}
                onChange={(e) => update({ opensTime: e.target.value })}
              />
            </label>
            <label>
              Hạn đúng giờ — sau ngày mở (ngày)
              <input
                type="number"
                min={0}
                max={31}
                required
                value={rule.dueAfterDays}
                onChange={(e) =>
                  update({ dueAfterDays: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Giờ hạn nộp
              <input
                type="time"
                required
                value={rule.dueTime}
                onChange={(e) => update({ dueTime: e.target.value })}
              />
            </label>
            <label>
              Khóa nhận — sau ngày mở (ngày)
              <input
                type="number"
                min={0}
                max={62}
                required
                value={rule.closeAfterDays}
                onChange={(e) =>
                  update({ closeAfterDays: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Giờ khóa nhận
              <input
                type="time"
                required
                value={rule.closesTime}
                onChange={(e) => update({ closesTime: e.target.value })}
              />
            </label>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            Tự tạo thêm các kỳ kế tiếp theo lịch này
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={applyOpen}
              onChange={(e) => setApplyOpen(e.target.checked)}
            />
            Áp dụng thay đổi cả kỳ tự động đang mở (giữ hạn riêng của đơn vị)
          </label>
          <p className="muted">
            Mặc định chỉ cập nhật kỳ tự động chưa mở. Kỳ chỉnh thủ công và hạn
            riêng được giữ nguyên; không sửa kỳ đã khóa. Tắt tự tạo không hủy
            các kỳ đã lên lịch. Báo cáo dùng số liệu trọn kỳ trước; ngày 29–31
            được lùi về ngày cuối tháng nếu tháng không có ngày đó.
          </p>
          <div className="actions end">
            <button className="button" disabled={busy}>
              <Save size={16} />
              {busy ? "Đang cập nhật lịch…" : "Lưu thời gian mặc định"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
