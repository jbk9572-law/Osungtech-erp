import { CELL } from "./InvoiceMetrics";

// 라벨(th)은 가운데 정렬, 값(td)은 왼쪽 정렬이 기본값 (0707 원본 인쇄본 기준).
// 숫자 열이나 특별히 가운데/왼쪽 정렬이 필요한 값은 align prop으로 개별 지정한다.
export function Cell({
  as = "td",
  colSpan,
  rowSpan,
  className = "",
  style,
  wrap = false,
  align,
  valign = "middle",
  hideBorder = [],
  children,
}: {
  as?: "td" | "th";
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  style?: React.CSSProperties;
  wrap?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle";
  hideBorder?: Array<"t" | "b" | "l" | "r">;
  children?: React.ReactNode;
}) {
  const Tag = as;
  const resolvedAlign = align ?? (as === "th" ? "center" : "left");
  const alignClass =
    resolvedAlign === "center" ? "text-center" : resolvedAlign === "right" ? "text-right" : "text-left";
  const valignClass = valign === "top" ? "align-top" : "align-middle";
  // 각 변의 두께 클래스를 사이드별로 정확히 하나씩만 부여해야 tailwind 클래스
  // 충돌(같은 우선순위의 상반된 유틸리티가 소스 순서와 무관하게 적용되는 문제) 없이 안전하다.
  const sideClass = {
    t: hideBorder.includes("t") ? "border-t-0" : "border-t",
    b: hideBorder.includes("b") ? "border-b-0" : "border-b",
    l: hideBorder.includes("l") ? "border-l-0" : "border-l",
    r: hideBorder.includes("r") ? "border-r-0" : "border-r",
  };
  // border-current 대신 CSS 변수를 참조: 특정 셀의 글자색을 검은색으로 덮어써도
  // (예: 사업자번호/상호/성명 등 실제 데이터 값) 테두리 색까지 검게 변하지 않도록
  // 테두리 색은 항상 테마색(--invoice-line)을 그대로 참조한다.
  const borderClass = `border-[var(--invoice-line)] ${sideClass.t} ${sideClass.b} ${sideClass.l} ${sideClass.r}`;
  return (
    <Tag
      colSpan={colSpan}
      rowSpan={rowSpan}
      style={{ paddingLeft: CELL.paddingX, paddingRight: CELL.paddingX, paddingTop: 0, paddingBottom: 0, ...style }}
      className={`overflow-hidden ${borderClass} ${alignClass} ${valignClass} font-normal ${wrap ? "whitespace-normal break-words text-clip" : "whitespace-nowrap text-ellipsis"} ${className}`}
    >
      {children}
    </Tag>
  );
}
