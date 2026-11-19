"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeLotNumber } from "@/lib/lot-number";
import { useThemeFeatures } from "@/lib/erp-theme-features";

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
  const { voucherLayout } = useThemeFeatures();
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
      {!voucherLayout && <td className="erp-u-muted">{unit ?? "-"}</td>}
    </>
  );
}

// voucherLayout 테마의 비고 — 표 칸 대신 줄 끝 [✎] 버튼이 작은 입력창을 띄운다(시안처럼 표를 좁게 유지). 값이 있으면 버튼이 강조되고 마우스를 올리면 내용이 보인다.
// 입력창은 표의 스크롤 영역에 잘리지 않게 body에 띄운다. Enter·Esc·바깥 클릭으로 닫는다(Esc는 전표 저장으로 번지지 않게 막는다).
function RemarkPopoverButton({ remark, onRemarkChange }: { remark: string; onRemarkChange: (value: string) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = () => setRect(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`erp-btn erp-btn-sm erp-u-minw-0 erp-u-mr-4 erp-row-action${remark ? " erp-row-action-on" : ""}`}
        title={remark ? `비고: ${remark}` : "비고 입력"}
        aria-label="비고 입력"
        onClick={() => setRect(btnRef.current?.getBoundingClientRect() ?? null)}
      >
        ✎
      </button>
      {rect &&
        createPortal(
          <>
            <div className="erp-remark-pop-backdrop" onMouseDown={close} />
            <input
              autoFocus
              className="erp-input erp-remark-pop"
              style={{ top: rect.bottom + 4, left: Math.max(8, rect.right - 260) }}
              placeholder="비고"
              aria-label="비고"
              value={remark}
              onChange={(e) => onRemarkChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                  btnRef.current?.focus();
                }
              }}
            />
          </>,
          document.body,
        )}
    </>
  );
}

// 품목 줄 맨 끝의 "비고 입력칸 + 이 줄 아래 삽입 / 삭제 버튼" 두 칸 — 두 폼이 글자 그대로 똑같았다. voucherLayout 테마는 비고 칸이 없고 줄 끝 버튼 묶음만 그린다.
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
  const { voucherLayout } = useThemeFeatures();
  return (
    <>
      {!voucherLayout && (
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
      )}
      <td className="num erp-u-nowrap">
        {voucherLayout && <RemarkPopoverButton remark={remark} onRemarkChange={onRemarkChange} />}
        <button type="button" className={`erp-btn erp-btn-sm erp-u-minw-0 erp-u-mr-4${voucherLayout ? " erp-row-action" : ""}`} onClick={onInsert} title="이 줄 아래에 빈 줄 삽입" aria-label="이 줄 아래에 빈 줄 삽입">
          {voucherLayout ? "+" : "+ 삽입"}
        </button>
        <button type="button" className={voucherLayout ? "erp-btn erp-btn-sm erp-u-minw-0 erp-row-action erp-row-action-danger" : "erp-btn erp-btn-danger erp-btn-sm erp-u-minw-0"} onClick={onRemove} disabled={!canRemove} aria-label="이 줄 삭제">
          {voucherLayout ? "✕" : "삭제"}
        </button>
      </td>
    </>
  );
}
