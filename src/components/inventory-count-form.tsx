"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { submitStockCount } from "@/app/(dashboard)/inventory/actions";
import { NumberInput } from "@/components/number-input";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export type CountRow = {
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string | null;
  systemQuantity: number;
};

type SavedAdjustment = CountRow & { countedQuantity: number };

// 차이가 유독 크면(전산 재고의 절반 이상, 최소 10개 이상) 단순 오차보다
// 입력 실수나 놓친 사유가 있을 가능성이 커서, 저장을 막지는 않되 저장
// 전에 한 번 더 눈에 띄게 표시한다 — 이게 없으면 숫자만 슥 바꾸고
// 아무 확인 없이 저장 버튼을 누르기 쉽다(사용자 피드백: "찾는 과정이
// 아니라 그냥 눌러서 저장하면 조정해버리는 것 같다").
function isLargeDiscrepancy(systemQuantity: number, diff: number): boolean {
  if (diff === 0) return false;
  const base = Math.max(Math.abs(systemQuantity), 1);
  return Math.abs(diff) >= 10 && Math.abs(diff) / base >= 0.5;
}

export function InventoryCountForm({
  rows,
  warehouseId,
}: {
  rows: CountRow[];
  warehouseId: string;
}) {
  const [state, formAction, pending] = useActionState(submitStockCount, undefined);
  // 기본값을 전산 재고와 똑같이 채워둬서, 직원은 실제로 다른 품목의
  // 칸만 고치면 된다 — 전체 품목 수만큼 매번 처음부터 입력할 필요가 없다.
  const [counted, setCounted] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.productId, r.systemQuantity]))
  );
  // 서버에 저장한 뒤에도 페이지 자체는 다시 안 불러오므로(revalidatePath는
  // /inventory만 갱신), rows의 systemQuantity는 그대로 예전 값에 머문다.
  // 이걸 그냥 두면 저장 직후에도 "차이"가 그대로 남아있는 것처럼 보이고,
  // 실수로 같은 조정을 또 저장 버튼을 눌러 중복 반영할 위험도 있었다.
  // 저장에 성공한 품목만 baseline을 방금 실사한 값으로 맞춰준다.
  const [baseline, setBaseline] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.productId, r.systemQuantity]))
  );
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [note, setNote] = useState("");
  const [savedSummary, setSavedSummary] = useState<SavedAdjustment[] | null>(null);
  // 실사 이력을 훑어보는 게 기본 화면이고, 새로 실사를 시작할 때만 전체
  // 품목 표를 펼친다(모조지 계산 이력 화면의 "+ 새로 계산하기" 토글과 같은
  // 방식) — 246개 품목 표가 이력 위에 항상 펼쳐져 있으면 이력을 보러 온
  // 사람도 매번 큰 표부터 지나쳐야 했다.
  const [started, setStarted] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const changedRows = useMemo(
    () =>
      rows
        .map((r) => ({
          ...r,
          systemQuantity: baseline[r.productId] ?? r.systemQuantity,
          countedQuantity: counted[r.productId] ?? r.systemQuantity,
        }))
        .filter((r) => r.countedQuantity !== r.systemQuantity),
    [rows, counted, baseline]
  );

  // 저장 성공 시: 방금 저장한 조정 내역을 요약 패널에 보여주고, baseline을
  // 갱신해서 같은 화면에서 또 저장 버튼을 눌러도 이미 반영된 품목이
  // 중복으로 다시 저장되지 않게 한다.
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a server action result, not derived state
      setSavedSummary(changedRows);
      setBaseline((prev) => {
        const next = { ...prev };
        for (const r of changedRows) next[r.productId] = r.countedQuantity;
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to state changing, changedRows is read at that moment
  }, [state]);

  const visibleRows = onlyDiff
    ? rows.filter(
        (r) => (counted[r.productId] ?? r.systemQuantity) !== (baseline[r.productId] ?? r.systemQuantity)
      )
    : rows;

  const payload = JSON.stringify(
    changedRows.map((r) => ({
      productId: r.productId,
      systemQuantity: r.systemQuantity,
      countedQuantity: r.countedQuantity,
    }))
  );

  if (!started) {
    return (
      <div className="erp-new-count-cta">
        <div className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          전산 재고 {rows.length.toLocaleString()}개 품목 기준으로 새 실사를 시작합니다. 실제로 다른
          품목만 고쳐서 저장하면 됩니다.
        </div>
        <button type="button" onClick={() => setStarted(true)} className="erp-btn erp-btn-primary">
          + 새 실사 시작
        </button>
      </div>
    );
  }

  return (
    <div className="erp-detail" style={{ marginTop: 0, borderColor: "var(--erp-primary)" }}>
      <div className="erp-detail-tabs" style={{ justifyContent: "space-between", paddingRight: 6 }}>
        <span className="erp-detail-tab active" style={{ borderRight: "none", cursor: "default" }}>
          진행 중인 실사
        </span>
        <button
          type="button"
          onClick={() => setStarted(false)}
          className="erp-btn"
          style={{ minWidth: 0, height: 26, padding: "0 10px" }}
        >
          접기
        </button>
      </div>
      <div className="erp-detail-body">
      <form action={formAction}>
      <input type="hidden" name="warehouse_id" value={warehouseId} />
      <input type="hidden" name="rows" value={payload} />
      <input type="hidden" name="note" value={note} />
      <div className="erp-search" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <label
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--erp-text-muted)" }}
        >
          <input
            type="checkbox"
            checked={onlyDiff}
            onChange={(e) => setOnlyDiff(e.target.checked)}
          />
          차이 있는 품목만 보기
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
            차이 {changedRows.length}건
          </span>
          <button
            ref={submitRef}
            type="submit"
            disabled={pending || changedRows.length === 0}
            className="erp-btn erp-btn-primary"
          >
            {pending ? (
              <>
                <span className="erp-spinner" aria-hidden /> 저장 중...
              </>
            ) : (
              `F7 실사 결과 저장 (${changedRows.length}건)`
            )}
          </button>
        </div>
      </div>
      {/* 실사는 "전산 재고를 실물에 맞춰 덮어쓰는" 동작이라, 왜 차이가
          났는지(파손/샘플/입고 누락 등) 최소한의 흔적을 남겨야 나중에
          이력을 보고 원인을 되짚어볼 수 있다 — 반품 사유를 표준 코드로
          남기는 것과 같은 이유. 저장을 막지는 않되(작지 않은 원인은
          현장에서 바로 못 밝혀낼 수도 있다), 비워두면 이력에 "-"로 남아
          기록을 안 남겼다는 사실 자체가 보이게 한다. */}
      <div className="erp-field" style={{ marginTop: 8 }}>
        <label htmlFor="count-note">사유 / 메모 (선택)</label>
        <input
          id="count-note"
          type="text"
          autoComplete="off"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 파손 3개 폐기, 분기 정기실사 등 — 나중에 이력에서 원인을 되짚어볼 때 도움이 됩니다"
          className="erp-input"
          style={{ width: "100%" }}
        />
      </div>
      <FormMessage state={state} />
      {savedSummary && savedSummary.length > 0 && (
        <div
          className="rounded p-2 text-xs"
          style={{
            marginTop: 8,
            background: "var(--erp-success-bg)",
            border: "1px solid var(--erp-success-border)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <strong style={{ color: "var(--erp-success)" }}>
              이번 실사에서 {savedSummary.length}개 품목이 조정되었습니다.
            </strong>
            <button
              type="button"
              onClick={() => setSavedSummary(null)}
              className="text-[11px] font-semibold"
              style={{ color: "var(--erp-text-muted)" }}
            >
              닫기
            </button>
          </div>
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>품목명</th>
                  <th className="num" style={{ width: 110 }}>
                    이전 수량
                  </th>
                  <th className="num" style={{ width: 110 }}>
                    조정 후
                  </th>
                  <th className="num" style={{ width: 90 }}>
                    차이
                  </th>
                </tr>
              </thead>
              <tbody>
                {savedSummary.map((r) => {
                  const diff = r.countedQuantity - r.systemQuantity;
                  return (
                    <tr key={r.productId}>
                      <td>{r.sku}</td>
                      <td>{r.name}</td>
                      <td className="num">{r.systemQuantity.toLocaleString()}</td>
                      <td className="num">{r.countedQuantity.toLocaleString()}</td>
                      <td
                        className="num"
                        style={{
                          fontWeight: 700,
                          color: diff > 0 ? "var(--erp-success)" : "var(--erp-danger)",
                        }}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="erp-grid-wrap" style={{ marginTop: 8 }}>
        <table className="erp-grid">
          <thead>
            <tr>
              <th>SKU</th>
              <th>품목명</th>
              <th style={{ width: 140 }}>규격</th>
              <th className="num" style={{ width: 110 }}>
                전산 재고
              </th>
              <th className="num" style={{ width: 140 }}>
                실사 수량
              </th>
              <th className="num" style={{ width: 100 }}>
                차이
              </th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const systemQuantity = baseline[row.productId] ?? row.systemQuantity;
              const value = counted[row.productId] ?? systemQuantity;
              const diff = value - systemQuantity;
              const flagged = isLargeDiscrepancy(systemQuantity, diff);
              return (
                <tr key={row.productId}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.spec || "-"}</td>
                  <td className="num">
                    {systemQuantity.toLocaleString()} {row.unit ?? ""}
                  </td>
                  <td className="num">
                    <NumberInput
                      value={value}
                      onChange={(n) =>
                        setCounted((prev) => ({ ...prev, [row.productId]: n }))
                      }
                      className="erp-input w-full"
                    />
                  </td>
                  <td
                    className="num"
                    style={{
                      fontWeight: diff !== 0 ? 700 : undefined,
                      color:
                        diff > 0
                          ? "var(--erp-success)"
                          : diff < 0
                            ? "var(--erp-danger)"
                            : "var(--erp-text-muted)",
                    }}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff.toLocaleString()}
                  </td>
                  <td>
                    {flagged && (
                      <span className="erp-badge erp-badge-warning" title="전산 재고 대비 차이가 큽니다 — 위 사유란에 원인을 남겨두는 걸 권장합니다.">
                        ⚠ 확인 필요
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!visibleRows.length && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  {onlyDiff ? "차이 있는 품목이 없습니다." : "표시할 품목이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </form>
      </div>
    </div>
  );
}
