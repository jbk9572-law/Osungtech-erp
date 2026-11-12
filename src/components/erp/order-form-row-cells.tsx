"use client";

import { normalizeLotNumber } from "@/lib/lot-number";

// 매출/매입 등록 폼 품목 표의 한 줄 안에서, 두 폼이 글자 그대로 똑같이 들고 있던
// "규격 · 관리번호 · 단위" 세 칸. 수량 칸부터는 두 폼의 동작이 달라(매입은 출고수량과 연동)
// 각 폼에 그대로 둔다. 값 변경은 폼의 updateRow(key, patch)에 그대로 넘기도록 patch 한 개로 받는다.

export type SpecLotPatch = { spec?: string; manualSpec?: boolean; lotNumber?: string };

export function SpecLotUnitCells({
  spec,
  manualSpec,
  hasProduct,
  productSpec,
  lotNumber,
  unit,
  onPatch,
}: {
  spec: string;
  manualSpec: boolean;
  hasProduct: boolean;
  productSpec: string | null | undefined;
  lotNumber: string;
  unit: string | null | undefined;
  onPatch: (patch: SpecLotPatch) => void;
}) {
  return (
    <>
      <td>
        <input
          type="text"
          placeholder="규격"
          aria-label="규격"
          value={spec}
          onChange={(e) => onPatch({ spec: e.target.value })}
          disabled={!manualSpec}
          className="erp-input w-full disabled:bg-[var(--erp-bg-disabled)] disabled:text-[var(--erp-text-muted)]"
        />
        {hasProduct && (
          <label className="mt-1 flex items-center gap-1 text-[10.5px] erp-u-muted">
            <input
              type="checkbox"
              checked={manualSpec}
              onChange={(e) => {
                const nextManualSpec = e.target.checked;
                onPatch({
                  manualSpec: nextManualSpec,
                  ...(nextManualSpec ? {} : { spec: productSpec ?? "" }),
                });
              }}
            />
            직접입력
          </label>
        )}
      </td>
      <td>
        <input
          type="text"
          placeholder="관리번호"
          aria-label="관리번호"
          value={lotNumber}
          onChange={(e) => onPatch({ lotNumber: normalizeLotNumber(e.target.value) })}
          className="erp-input w-full"
        />
      </td>
      <td className="erp-u-muted">{unit ?? "-"}</td>
    </>
  );
}

// 품목 줄 맨 끝의 "비고 입력칸 + 이 줄 아래 삽입 / 삭제 버튼" 두 칸 — 두 폼이 글자 그대로 똑같았다.
export function RemarkActionCells({
  remark,
  onRemarkChange,
  onInsert,
  onRemove,
  canRemove,
}: {
  remark: string;
  onRemarkChange: (value: string) => void;
  onInsert: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <>
      <td>
        <input
          type="text"
          placeholder="비고"
          aria-label="비고"
          value={remark}
          onChange={(e) => onRemarkChange(e.target.value)}
          className="erp-input w-full"
        />
      </td>
      <td className="num" style={{ whiteSpace: "nowrap" }}>
        <button
          type="button"
          className="erp-btn erp-btn-sm erp-u-minw-0 erp-u-mr-4"
          onClick={onInsert}
          title="이 줄 아래에 빈 줄 삽입"
        >
          + 삽입
        </button>
        <button
          type="button"
          className="erp-btn erp-btn-danger erp-btn-sm erp-u-minw-0"
          onClick={onRemove}
          disabled={!canRemove}
        >
          삭제
        </button>
      </td>
    </>
  );
}
