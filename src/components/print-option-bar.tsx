import Link from "next/link";
import { buildPrintOptionHref, type PrintOptionParams } from "@/lib/print-options";

export type PrintOptionGroup = {
  // 주소의 ?key=value 에서 key
  key: string;
  // 그룹 이름(예: "출력", "용지", "미수금")
  label: string;
  options: { value: string; label: string }[];
  // 지금 고른 값
  current: string;
};

// 명세표(매출/매입) 인쇄 옵션 줄 — 두 화면이 똑같은 3중 세그먼트 마크업을 각자 복붙해 들고 있던 것을 한 곳으로 모았다.
// 그룹 이름을 붙여서 어느 버튼이 무엇을 바꾸는지 한눈에 보이게 하고, 모바일에서는 한 줄씩 쌓이며 버튼이 터치하기 좋은 높이로 커진다.
export function PrintOptionBar({
  basePath,
  params,
  groups,
}: {
  basePath: string;
  params: PrintOptionParams;
  groups: PrintOptionGroup[];
}) {
  return (
    <div className="erp-optbar print:hidden" role="group" aria-label="인쇄 옵션">
      {groups.map((g) => (
        <div key={g.key} className="erp-optbar-group">
          <span className="erp-optbar-label">{g.label}</span>
          <div className="erp-seg" role="group" aria-label={g.label}>
            {g.options.map((o) => (
              <Link
                key={o.value}
                href={buildPrintOptionHref(basePath, params, g.key, o.value)}
                replace
                scroll={false}
                aria-current={g.current === o.value ? "true" : undefined}
                className={`erp-seg-btn${g.current === o.value ? " active" : ""}`}
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
