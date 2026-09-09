"use client";

import { useEffect, useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { PageGuide } from "@/components/erp/page-guide";
import type { LocationOption } from "@/lib/location-stock-sync";

export type MultiLocationItem = {
  // 화면에 같이 떠야 하는 두 목록(예: 매입+출고 동시등록의 입고 품목과
  // 출고 품목)에 같은 productId가 겹칠 수 있어서, 입력값을 구분해서 담을
  // 고유 키를 따로 둔다. 보통은 productId를 그대로 쓰면 된다.
  groupKey: string;
  productId: string;
  productName: string;
  spec: string | null;
  unit: string;
  quantity: number;
  locations: LocationOption[];
  // "입고" | "출고" — 한 모달에 두 방향이 섞여 있을 때만 뱃지로 보여준다.
  direction?: string;
};

export type MultiLocationConfirmResult = {
  groupKey: string;
  productId: string;
  allocations: { locationId: string; quantity: number }[];
}[];

// 재고가 가장 많은 위치부터 채워서 기본값을 만든다 — 대부분은 그대로
// "확인"만 누르면 되고, 필요할 때만 직접 숫자를 고치면 된다. 위치 재고를
// 다 합쳐도 필요 수량에 못 미치면(마이너스 허용 설계) 남는 만큼을 재고가
// 가장 많은 위치에 몰아준다.
function buildDefaultAllocation(item: MultiLocationItem): Record<string, number> {
  const sorted = [...item.locations].sort((a, b) => b.quantity - a.quantity);
  const result: Record<string, number> = {};
  for (const loc of sorted) result[loc.locationId] = 0;
  let remaining = item.quantity;
  for (const loc of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Math.max(loc.quantity, 0));
    result[loc.locationId] = take;
    remaining -= take;
  }
  if (remaining > 0 && sorted.length > 0) {
    result[sorted[0].locationId] += remaining;
  }
  return result;
}

export function LocationAllocationModal({
  open,
  items,
  actionLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  items: MultiLocationItem[];
  // "출고" | "입고" — 안내 문구에만 쓰인다. 개별 품목에 direction이 있으면
  // 그쪽이 뱃지로 우선 표시된다.
  actionLabel: string;
  onCancel: () => void;
  onConfirm: (result: MultiLocationConfirmResult) => void;
}) {
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});

  // 모달이 새로 열릴 때(또는 대상 품목이 바뀔 때)만 기본 배분값으로
  // 다시 채운다 — 열려 있는 동안 사용자가 고친 값을 매 렌더마다 덮어쓰면
  // 입력이 불가능해진다.
  useEffect(() => {
    if (!open) return;
    const next: Record<string, Record<string, number>> = {};
    for (const item of items) next[item.groupKey] = buildDefaultAllocation(item);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달이 열릴 때(open 전이)만 기본 배분값으로 다시 채우는 동기화
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open이 바뀔 때만 기본값을 다시 계산한다(items는 같은 렌더에서 함께 바뀐다)
  }, [open]);

  useEscapeToClose(open, onCancel);

  if (!open) return null;

  function setAmount(groupKey: string, locationId: string, amount: number) {
    setValues((prev) => ({
      ...prev,
      [groupKey]: { ...prev[groupKey], [locationId]: amount },
    }));
  }

  const sumsMatch = items.every(
    (item) => Object.values(values[item.groupKey] ?? {}).reduce((a, b) => a + b, 0) === item.quantity,
  );

  function handleConfirm() {
    const result: MultiLocationConfirmResult = items.map((item) => ({
      groupKey: item.groupKey,
      productId: item.productId,
      allocations: Object.entries(values[item.groupKey] ?? {})
        .filter(([, qty]) => qty > 0)
        .map(([locationId, qty]) => ({ locationId, quantity: qty })),
    }));
    onConfirm(result);
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 20, 30, 0.55)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="erp-detail" style={{ marginTop: 0, maxWidth: 520, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active" style={{ cursor: "default" }}>
            보관 위치 배분 확인
          </span>
        </div>
        <div className="erp-detail-body" style={{ overflow: "auto" }}>
          <PageGuide className="mb-3 text-left">
            아래 품목은 보관 위치가 2곳 이상입니다. 이번 {actionLabel} 수량을 어느 위치에서 반영할지 확인해주세요. 기본값은
            재고가 많은 위치부터 채워져 있습니다.
          </PageGuide>

          {items.map((item) => {
            const sum = Object.values(values[item.groupKey] ?? {}).reduce((a, b) => a + b, 0);
            const ok = sum === item.quantity;
            return (
              <div
                key={item.groupKey}
                style={{ marginBottom: 14, padding: 10, borderRadius: 6, border: "1px solid var(--erp-border)" }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                    {item.direction && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: item.direction === "출고" ? "var(--erp-danger-bg)" : "var(--erp-success-bg)",
                          color: item.direction === "출고" ? "var(--erp-danger)" : "var(--erp-success)",
                        }}
                      >
                        {item.direction}
                      </span>
                    )}
                    {item.productName}
                    {item.spec && <span style={{ fontWeight: 400, color: "var(--erp-text-muted)" }}> ({item.spec})</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--erp-text-muted)", whiteSpace: "nowrap" }}>
                    필요 {item.quantity.toLocaleString()} {item.unit}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {item.locations.map((loc) => (
                    <div key={loc.locationId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, fontSize: 12.5 }}>
                        {loc.code}
                        <span style={{ color: "var(--erp-text-muted)" }}>
                          {" "}
                          ({loc.tier === 2 ? "2단" : "1단"}·{loc.position === 1 ? "좌측" : "우측"}) · 현재{" "}
                          {loc.quantity.toLocaleString()}
                        </span>
                      </div>
                      <input
                        type="number"
                        className="erp-input"
                        style={{ width: 90, flexShrink: 0 }}
                        value={values[item.groupKey]?.[loc.locationId] ?? 0}
                        onChange={(e) => setAmount(item.groupKey, loc.locationId, Number(e.target.value) || 0)}
                      />
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: ok ? "var(--erp-success)" : "var(--erp-danger)",
                  }}
                >
                  배분 합계 {sum.toLocaleString()} / 필요 {item.quantity.toLocaleString()}
                  {!ok && " — 합계를 필요 수량과 맞춰주세요"}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--erp-border)" }}>
          <button type="button" className="erp-btn" style={{ flex: 1 }} onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-primary"
            style={{ flex: 1 }}
            disabled={!sumsMatch}
            onClick={handleConfirm}
          >
            확인하고 저장
          </button>
        </div>
      </div>
    </div>
  );
}
