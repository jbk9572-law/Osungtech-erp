import Link from "next/link";

// 기간(시작일~종료일) + 검색어 조회 폼 — 견적서·구매요청·견적요청·영업활동처럼 "기간으로 좁히고 검색"하는 목록이 같이 쓴다.
// 폼 모양을 화면마다 다시 짜지 않는다(개발헌법 3번). 조회(F5)는 KeyboardShortcuts가 이 폼의 id로 제출한다.
export function DateRangeSearchForm({
  formId,
  idPrefix,
  from,
  to,
  q,
  qLabel,
  qPlaceholder,
  resetHref,
  showReset,
  hideSubmit,
}: {
  formId: string;
  /** 입력칸 id 접두어(같은 화면에 폼이 하나뿐이라도 label 연결을 위해 필요) */
  idPrefix: string;
  from?: string;
  to?: string;
  q?: string;
  qLabel: string;
  qPlaceholder: string;
  resetHref: string;
  /** 조건이 하나라도 걸려 있으면 [초기화]를 보여준다 */
  showReset: boolean;
  /** 조회 버튼을 화면에서 숨긴다(목록 위 도구 줄의 [조회]가 대신 제출) — Enter로 제출되도록 안 보이는 제출 버튼은 남긴다. */
  hideSubmit?: boolean;
}) {
  return (
    <form method="get" id={formId} className="erp-field-grid">
      <div className="erp-field erp-span-2">
        <label htmlFor={`${idPrefix}-from`}>시작일</label>
        <input id={`${idPrefix}-from`} type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
      </div>
      <div className="erp-field erp-span-2">
        <label htmlFor={`${idPrefix}-to`}>종료일</label>
        <input id={`${idPrefix}-to`} type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
      </div>
      <div className="erp-field erp-span-4">
        <label htmlFor={`${idPrefix}-q`}>{qLabel}</label>
        <input id={`${idPrefix}-q`} type="text" name="q" autoComplete="off" defaultValue={q ?? ""} placeholder={qPlaceholder} className="erp-input erp-u-w-full" />
      </div>
      {hideSubmit ? (
        <button type="submit" hidden tabIndex={-1} aria-hidden />
      ) : (
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
      )}
      {showReset && (
        <Link href={resetHref} className="erp-btn">
          초기화
        </Link>
      )}
    </form>
  );
}
