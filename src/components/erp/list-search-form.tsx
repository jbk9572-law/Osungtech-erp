import type { ReactNode } from "react";
import Link from "next/link";

// 검색어 한 줄 조회 폼 — [앞 버튼(선택)] + 입력칸 + [F5 조회] + [초기화(선택)]. 거래처·품목·하청업체·할일처럼 검색어만 쓰는 목록이 같이 쓴다(개발헌법 3번).
// 조회(F5)는 KeyboardShortcuts가 이 폼의 id로 제출한다. hidden은 필터 열 선택처럼 조회해도 유지할 값.
export function ListSearchForm({
  formId,
  q,
  placeholder,
  ariaLabel,
  resetHref,
  hidden,
  leading,
  hideSubmit,
  className,
}: {
  formId: string;
  q?: string;
  placeholder: string;
  ariaLabel: string;
  resetHref?: string;
  hidden?: Record<string, string>;
  leading?: ReactNode;
  /** 조회 버튼을 숨긴다(Enter·F5로만 조회) — 좁은 목록 칸 안의 검색줄용 */
  hideSubmit?: boolean;
  className?: string;
}) {
  return (
    <form id={formId} method="get" className={`erp-party-search${className ? ` ${className}` : ""}`}>
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {leading}
      <input type="text" name="q" autoComplete="off" defaultValue={q ?? ""} placeholder={placeholder} className="erp-input" aria-label={ariaLabel} />
      {!hideSubmit && (
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
      )}
      {q && resetHref && (
        <Link href={resetHref} className="erp-btn">
          초기화
        </Link>
      )}
    </form>
  );
}
