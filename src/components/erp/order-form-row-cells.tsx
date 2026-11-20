"use client";

import { useRef, useState } from "react";
import { CellPopover } from "@/components/erp/cell-popover";
import { RowOptionsButton, type RowOption } from "@/components/erp/row-options";
import { normalizeLotNumber } from "@/lib/lot-number";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 매출/매입 등록 폼 품목 표의 한 줄 안에서, 두 폼이 글자 그대로 똑같이 들고 있던
// "규격 · 관리번호 · 단위" 세 칸. 수량 칸부터는 두 폼의 동작이 달라(매입은 출고수량과 연동)
// 각 폼에 그대로 둔다. 값 변경은 폼의 updateRow(key, patch)에 그대로 넘기도록 patch 한 개로 받는다.

export type SpecLotPatch = { spec?: string; manualSpec?: boolean; lotNumber?: string };

/** 품목 칸 아래 "품목없이 직접입력" 체크 — 두 폼이 같은 마크업을 갖고 있던 것을 한 곳으로. voucherLayout 테마는 칸을 가리지 않도록 줄 끝 [⚙ 행 옵션]으로 옮겨 가서 아무것도 그리지 않는다. */
export function CustomEntryToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  if (useThemeFeatures().voucherLayout) return null;
  return (
    <label className="mt-1 flex items-center gap-1 text-[10.5px] erp-u-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      품목없이 직접입력
    </label>
  );
}

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
        {hasProduct && !voucherLayout && (
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
// Enter·Esc·바깥 클릭으로 닫는다(공용 틀: cell-popover.tsx).
function RemarkPopoverButton({ remark, onRemarkChange }: { remark: string; onRemarkChange: (value: string) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setRect(null);
    btnRef.current?.focus();
  };
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
      {rect && (
        <CellPopover rect={rect} onClose={close} label="비고 입력">
          <input
            autoFocus
            className="erp-input erp-u-w-full"
            placeholder="비고"
            aria-label="비고"
            value={remark}
            onChange={(e) => onRemarkChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
          />
        </CellPopover>
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
  rowOptions = [],
}: {
  remark: string;
  onRemarkChange: (value: string) => void;
  onInsert: () => void;
  onRemove: () => void;
  canRemove: boolean;
  /** 줄 단위 켜고 끄기(품목없이 직접입력·규격/단가 직접입력) — voucherLayout 테마에서 [⚙]로 보인다 */
  rowOptions?: RowOption[];
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
        {voucherLayout && <RowOptionsButton options={rowOptions} />}
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
