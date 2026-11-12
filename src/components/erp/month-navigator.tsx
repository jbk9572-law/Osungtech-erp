import Link from "next/link";
import { currentMonth, shiftMonth } from "@/lib/date-presets";

// 월별 리포트/거래처 상세/간이 손익계산서가 각자 거의 똑같은
// "◀ 이전달 / 이번달 / 다음달 ▶" 마크업을 복붙해서 쓰고 있었다(간이
// 손익계산서는 스타일/라벨까지 따로 — "← YYYY-MM" 식). 한 곳으로 모아
// 화면마다 모양이 갈라지지 않게 한다. month 이외의 쿼리 파라미터(검색어,
// 보기 종류, 거래처 등)는 suffix로 그대로 이어 붙인다(예: "&q=foo").
//
// prefetch={false}: date-range-quick-filters.tsx와 같은 이유 — 이전달/
// 이번달/다음달 중 사용자는 최대 하나만 클릭하는데, Next.js Link는
// 화면에 보이면 기본적으로 셋 다 미리 불러온다. 화면 수는 적어도(3개)
// 운영 로그에서 실제로 불필요한 백그라운드 요청이 확인된 같은 패턴이라
// 같이 고친다.
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
    <div className="erp-date-presets erp-u-mb-8">
      <Link href={`${baseHref}?month=${prevMonth}${suffix}`} prefetch={false} className="erp-date-preset-btn">
        ◀ 이전달
      </Link>
      <Link
        href={`${baseHref}?month=${thisMonth}${suffix}`}
        prefetch={false}
        className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`}
      >
        이번달
      </Link>
      <Link href={`${baseHref}?month=${nextMonth}${suffix}`} prefetch={false} className="erp-date-preset-btn">
        다음달 ▶
      </Link>
    </div>
  );
}
