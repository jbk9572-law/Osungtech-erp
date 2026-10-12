import Link from "next/link";
import { currentMonth, shiftMonth } from "@/lib/date-presets";

// 월별 리포트/거래처 상세/간이 손익계산서가 각자 거의 똑같은
// "◀ 이전달 / 이번달 / 다음달 ▶" 마크업을 복붙해서 쓰고 있었다(간이
// 손익계산서는 스타일/라벨까지 따로 — "← YYYY-MM" 식). 한 곳으로 모아
// 화면마다 모양이 갈라지지 않게 한다. month 이외의 쿼리 파라미터(검색어,
// 보기 종류, 거래처 등)는 suffix로 그대로 이어 붙인다(예: "&q=foo").
export function MonthNavigator({
  baseHref,
  month,
  suffix = "",
}: {
  baseHref: string;
  month: string;
  suffix?: string;
}) {
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = currentMonth();

  return (
    <div className="erp-date-presets" style={{ marginBottom: 8 }}>
      <Link href={`${baseHref}?month=${prevMonth}${suffix}`} className="erp-date-preset-btn">
        ◀ 이전달
      </Link>
      <Link
        href={`${baseHref}?month=${thisMonth}${suffix}`}
        className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`}
      >
        이번달
      </Link>
      <Link href={`${baseHref}?month=${nextMonth}${suffix}`} className="erp-date-preset-btn">
        다음달 ▶
      </Link>
    </div>
  );
}
