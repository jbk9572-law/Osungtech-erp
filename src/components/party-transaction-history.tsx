"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  kind: string;
  date: string;
  label: string;
  total: number;
  balance: number;
};

type Preset = "recent2m" | "recent6m" | "thisYear" | "lastYearOn" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "recent2m", label: "최근2개월" },
  { key: "recent6m", label: "최근6개월" },
  { key: "thisYear", label: "올해 전체" },
  { key: "lastYearOn", label: "작년 1월부터" },
  { key: "custom", label: "직접입력" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetFromDate(preset: Preset, customFrom: string): string | undefined {
  const now = new Date();
  if (preset === "recent2m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 2);
    return toDateStr(d);
  }
  if (preset === "recent6m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 6);
    return toDateStr(d);
  }
  if (preset === "thisYear") return `${now.getFullYear()}-01-01`;
  if (preset === "lastYearOn") return `${now.getFullYear() - 1}-01-01`;
  return customFrom || undefined;
}

// 수금/지급 등록 화면에서 이 거래처의 매출(매입)·수금(지급) 내역을 기간별로
// 조회만 하는 참고용 패널이다. 실제 정산(어느 수금이 어느 전표를 갚았는지)은
// 여전히 lib/ar-ap.ts의 오래된 전표부터 상계하는 로직 그대로 유지된다 —
// 여기서 하나를 골라 지정하는 게 아니다.
export function PartyTransactionHistory({
  partyId,
  fetchHistory,
  title,
  positiveKind,
  kindLabels,
}: {
  partyId: string;
  fetchHistory: (partyId: string, fromDate?: string) => Promise<Row[]>;
  title: string;
  positiveKind: string;
  kindLabels: Record<string, string>;
}) {
  const [preset, setPreset] = useState<Preset>("recent6m");
  const [customFrom, setCustomFrom] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // partyId가 비면 컴포넌트 자체가 null을 반환하므로(아래) 굳이 rows를
    // 비울 필요 없이 그냥 조회를 건너뛴다.
    if (!partyId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 거래처/기간이 바뀔 때마다 조회를 새로 시작한다는 걸 알려주는 로딩 상태
    setLoading(true);
    const fromDate = presetFromDate(preset, customFrom);
    fetchHistory(partyId, fromDate)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partyId, preset, customFrom, fetchHistory]);

  if (!partyId) return null;

  return (
    <div className="erp-detail" style={{ marginTop: 12 }}>
      <div className="erp-detail-tabs">
        <span className="erp-detail-tab active">{title}</span>
      </div>
      <div className="erp-detail-body" style={{ padding: 12 }}>
        <div className="erp-date-presets" style={{ marginBottom: 10 }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              className={`erp-date-preset-btn${preset === p.key ? " active" : ""}`}
              style={{ border: "1px solid var(--erp-border)", cursor: "pointer" }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="erp-field" style={{ marginBottom: 10, maxWidth: 200 }}>
            <label htmlFor="pth-custom-from">시작일</label>
            <input
              id="pth-custom-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="erp-input"
              style={{ width: "100%" }}
            />
          </div>
        )}
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th style={{ width: 60 }}>유형</th>
                <th style={{ width: 90 }}>일자</th>
                <th>품목/적요</th>
                <th className="num" style={{ width: 110 }}>
                  합계
                </th>
                <th className="num" style={{ width: 110 }}>
                  잔액
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`erp-badge ${r.kind === positiveKind ? "erp-badge-info" : "erp-badge-warning"}`}>
                      {kindLabels[r.kind] ?? r.kind}
                    </span>
                  </td>
                  <td>{r.date.replaceAll("-", ".")}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{r.label}</td>
                  <td className="num">{r.total.toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {r.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="erp-grid-empty">
                    조회된 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 8, fontSize: 11, color: "var(--erp-text-muted)" }}>
          조회용입니다 — 실제 정산은 오래된 미결제 전표부터 자동으로 상계됩니다.
        </p>
      </div>
    </div>
  );
}
