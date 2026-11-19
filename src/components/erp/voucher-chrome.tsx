"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DraftSavedIndicator } from "@/components/draft-saved-indicator";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";
import { useModalClose } from "@/lib/modal-context";
import { GridCellRangeStats } from "@/components/erp/grid-cell-range";

// 매출/매입 전표 등록 모달의 "틀" — 테마에 따라 구조 자체가 다르다.
//  · 클래식: 가운데 제목 + "기본정보" 머리줄(오른쪽에 저장 버튼) + 표 아래 합계.
//  · voucherLayout 테마: 왼쪽 제목 + 상태 칩 한 줄, 머리줄 없음, 아래 고정 바(합계금액 + 저장 버튼).
// 두 전표 폼이 같은 조각을 쓰므로 한 곳을 고치면 둘 다 바뀐다.

// 전표 모달 맨 위 한 줄(제목 + 유형 탭 + 상태 칩). 유형 탭(매출/수금/반품)은 전환기(switcher)가, 상태 칩은 폼이 그린다 —
// 칩은 아래 슬롯으로 올려 보내(portal) 한 줄에 같이 보이게 한다. 클래식은 이 줄이 없고 탭만 기존 자리에 그린다.
const ChipSlotContext = createContext<HTMLElement | null>(null);

export function VoucherTypeBar({ title, children }: { title: string; children: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  if (!voucherLayout) return <>{children}</>;
  return (
    <ChipSlotContext.Provider value={slot}>
      <div className="erp-voucher-titlebar erp-voucher-typebar">
        <h2 className="erp-voucher-title">{title}</h2>
        {children}
        <span className="erp-voucher-chips" ref={setSlot} />
      </div>
    </ChipSlotContext.Provider>
  );
}

/** 테마 구조 플래그에 따라 자식을 숨긴다(예: voucherLayout 테마는 모달 위 큰 제목을 따로 두지 않는다). */
export function HideWhenVoucher({ children }: { children: ReactNode }) {
  return useThemeFeatures().voucherLayout ? null : <>{children}</>;
}

/** 전표 제목. 상태 칩(임시저장 시각, 이월, 샘플 등)은 children으로 받는다. 유형 줄(VoucherTypeBar) 안이면 칩만 그 줄로 올린다. */
export function VoucherTitle({ title, savedAt, children }: { title: string; savedAt: number | null; children?: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  const slot = useContext(ChipSlotContext);
  if (!voucherLayout) return <h2 className="erp-doc-title">{title.split("").join(" ")}</h2>;
  const chips = (
    <>
      <DraftSavedIndicator savedAt={savedAt} />
      {children}
    </>
  );
  if (slot) return createPortal(chips, slot);
  return (
    <div className="erp-voucher-titlebar">
      <h2 className="erp-voucher-title">{title}</h2>
      {chips}
    </div>
  );
}

/** "기본정보" 머리줄 — 클래식만 그린다(저장 버튼이 여기 있다). voucherLayout 테마는 하단 바로 옮겨 간다. */
export function VoucherBasicHead({ actions }: { actions: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  if (voucherLayout) return null;
  return (
    <div className="erp-form-section-head">
      <span className="erp-eyebrow erp-u-m-0">기본정보</span>
      {actions}
    </div>
  );
}

/** 재고 부족 경고 띠 — voucherLayout 테마만. 품목(상품) 단위로 합쳐서 넘긴다. */
export function VoucherWarning({ shortages }: { shortages: { name: string; short: number; unit: string }[] }) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout || shortages.length === 0) return null;
  const [first, ...rest] = shortages;
  return (
    <div className="erp-voucher-warning" role="alert">
      ⚠ {first.name} 출고 수량이 재고보다 {formatNumber(first.short)}{first.unit} 많습니다{rest.length > 0 && ` (외 ${rest.length}개 품목)`}. 저장하면 재고 부족으로 거부될 수 있습니다.
    </div>
  );
}

/** 하단 고정 바의 뼈대 — 왼쪽 단축키 안내, 오른쪽 [요약] [취소] [저장 영역]. voucherLayout 테마의 모든 문서 화면이 같은 바를 쓴다. */
function FooterShell({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  const close = useModalClose();
  return (
    <div className="erp-voucher-footer">
      <span className="erp-voucher-footer-hint">
        Esc 닫기
        <GridCellRangeStats />
      </span>
      <div className="erp-voucher-footer-right">
        {summary}
        {close && (
          <button type="button" className="erp-btn" onClick={close}>
            취소
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** 매출/매입 전표의 하단 바 — voucherLayout 테마만. 합계금액 요약 + 저장 버튼. */
export function VoucherFooter({ supply, tax, total, actions }: { supply: number; tax: number; total: number; actions: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout) return null;
  return (
    <FooterShell
      summary={
        <div className="erp-voucher-footer-sum">
          <span className="erp-u-muted erp-u-text-xs">
            공급가액 {formatNumber(supply)} · 부가세 {formatNumber(tax)}
          </span>
          <span className="erp-voucher-footer-label">합계금액</span>
          <b className="erp-voucher-footer-total">{formatNumber(total)}원</b>
        </div>
      }
    >
      {actions}
    </FooterShell>
  );
}

/**
 * 합계 없는 문서(견적서·구매요청서·세금계산서·지급결의서 등)의 저장 영역 — 클래식은 children을 제자리 그대로 그리고,
 * voucherLayout 테마는 같은 하단 바 안으로 옮긴다. 저장 버튼 마크업은 폼이 그대로 소유한다.
 */
export function DocSubmitBar({ children }: { children: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  return voucherLayout ? <FooterShell>{children}</FooterShell> : <>{children}</>;
}

/** 문서 폼 루트(<form>)에 붙일 클래스 — 테마 구조에 맞는 틀(.erp-voucher)을 켠다. 모든 문서 화면이 이걸 써서 틀이 갈라지지 않는다. */
export function useDocSheetClass(): string {
  return `erp-doc-sheet${useThemeFeatures().voucherLayout ? " erp-voucher" : ""}`;
}

/** 상태 칩 한 개(예: "이월 처리", "샘플"). */
export function VoucherChip({ tone = "muted", children }: { tone?: "muted" | "info" | "warning"; children: ReactNode }) {
  return <span className={`erp-voucher-chip erp-voucher-chip-${tone}`}>{children}</span>;
}

/** 표 맨 아래 "+ 품목 입력" 줄 — voucherLayout 테마만. 누르면 빈 줄 하나를 추가한다. */
export function VoucherAddRow({ colSpan, onAdd }: { colSpan: number; onAdd: () => void }) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout) return null;
  return (
    <tr className="erp-voucher-addrow">
      <td className="num erp-u-muted">+</td>
      <td colSpan={colSpan - 1}>
        <button type="button" className="erp-voucher-addrow-btn" onClick={onAdd}>
          품목 줄 추가
        </button>
      </td>
    </tr>
  );
}

/** 제목줄의 전표번호 칩 — 비워 두면 자동 채번. 숫자만 받는다(인쇄되는 거래명세표 No와 같은 번호). */
export function VoucherDocNoChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="erp-voucher-chip" title="비워두면 자동으로 채번됩니다. 인쇄되는 거래명세표의 No와 같은 번호입니다.">
      전표번호
      <input
        className="erp-voucher-chip-input"
        inputMode="numeric"
        placeholder="자동"
        aria-label="전표번호"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      />
    </label>
  );
}

/** 제목줄의 켜고 끄는 칩(예: 이월 처리). */
export function VoucherToggleChip({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className={`erp-voucher-chip erp-voucher-chip-toggle${checked ? " erp-voucher-chip-info" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/** 종이(erp-doc-paper) 없이 단순한 폼(수금·지급 등)의 <form> 클래스 — voucherLayout 테마에서만 같은 틀(띠·하단 바)을 켠다. 클래식은 빈 문자열. */
export function useFormSheetClass(): string {
  return useThemeFeatures().voucherLayout ? "erp-voucher erp-voucher-plain" : "";
}
