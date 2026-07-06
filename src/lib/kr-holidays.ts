// 대한민국 공휴일 계산
//
// - 양력 고정 공휴일: 매년 동일한 날짜로 자동 계산
// - 음력 기반 공휴일(설날/추석/부처님오신날): 음력→양력 변환이 필요해 연도별 환산일을
//   직접 표로 등록 (2024~2027, 향후 연도가 필요하면 이 표만 추가하면 됨)
// - 대체공휴일: 위 공휴일이 토/일요일이거나 다른 공휴일과 겹치면 자동으로 계산
// - 임시공휴일: 정부가 그때그때 발표하는 것이라 코드로 미리 예측할 수 없음.
//   확정 발표된 날짜만 TEMPORARY_HOLIDAYS에 수기로 추가.

const FIXED_HOLIDAYS: { month: number; day: number; name: string; substitutable: boolean }[] = [
  { month: 1, day: 1, name: "신정", substitutable: false },
  { month: 3, day: 1, name: "삼일절", substitutable: true },
  { month: 5, day: 5, name: "어린이날", substitutable: true },
  { month: 6, day: 6, name: "현충일", substitutable: false },
  { month: 8, day: 15, name: "광복절", substitutable: true },
  { month: 10, day: 3, name: "개천절", substitutable: true },
  { month: 10, day: 9, name: "한글날", substitutable: true },
  { month: 12, day: 25, name: "크리스마스", substitutable: true },
];

const LUNAR_HOLIDAYS: Record<number, { seollal: string; chuseok: string; buddha: string }> = {
  2024: { seollal: "2024-02-10", chuseok: "2024-09-17", buddha: "2024-05-15" },
  2025: { seollal: "2025-01-29", chuseok: "2025-10-06", buddha: "2025-05-05" },
  2026: { seollal: "2026-02-17", chuseok: "2026-09-25", buddha: "2026-05-24" },
  2027: { seollal: "2027-02-07", chuseok: "2027-09-15", buddha: "2027-05-13" },
};

const TEMPORARY_HOLIDAYS: { date: string; name: string }[] = [
  { date: "2025-01-27", name: "임시공휴일" },
];

const YEARS_TO_GENERATE = [2024, 2025, 2026, 2027, 2028, 2029];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toStr(d);
}

function dayOfWeek(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

type HolidayGroup = { dates: string[]; name: string; substitutable: boolean };

function buildHolidayMap(): Map<string, string> {
  const groups: HolidayGroup[] = [];

  for (const year of YEARS_TO_GENERATE) {
    const yearGroups: HolidayGroup[] = [];

    for (const f of FIXED_HOLIDAYS) {
      yearGroups.push({
        dates: [`${year}-${pad(f.month)}-${pad(f.day)}`],
        name: f.name,
        substitutable: f.substitutable,
      });
    }
    const lunar = LUNAR_HOLIDAYS[year];
    if (lunar) {
      yearGroups.push({
        dates: [addDays(lunar.seollal, -1), lunar.seollal, addDays(lunar.seollal, 1)],
        name: "설날",
        substitutable: true,
      });
      yearGroups.push({
        dates: [addDays(lunar.chuseok, -1), lunar.chuseok, addDays(lunar.chuseok, 1)],
        name: "추석",
        substitutable: true,
      });
      yearGroups.push({ dates: [lunar.buddha], name: "부처님오신날", substitutable: true });
    }

    // 어린이날과 부처님오신날이 같은 날에 겹치는 해(예: 2025년)에는 대체공휴일이
    // 하루만 지정되므로, 겹치는 두 단일 공휴일을 하나의 그룹으로 합친다.
    const childrensDay = yearGroups.find((g) => g.name === "어린이날");
    const buddhaDay = yearGroups.find((g) => g.name === "부처님오신날");
    if (childrensDay && buddhaDay && childrensDay.dates[0] === buddhaDay.dates[0]) {
      childrensDay.name = "어린이날 · 부처님오신날";
      yearGroups.splice(yearGroups.indexOf(buddhaDay), 1);
    }

    groups.push(...yearGroups);
  }

  // 같은 날짜에 공휴일이 여러 개 겹치는 경우(예: 2025년 어린이날+부처님오신날)를 감지하기 위해
  // 먼저 날짜별로 겹치는 공휴일 이름을 모두 모은다.
  const claims = new Map<string, Set<string>>();
  for (const g of groups) {
    for (const d of g.dates) {
      if (!claims.has(d)) claims.set(d, new Set());
      claims.get(d)!.add(g.name);
    }
  }

  const map = new Map<string, string>();
  for (const [date, names] of claims) {
    map.set(date, Array.from(names).join(" · "));
  }

  for (const t of TEMPORARY_HOLIDAYS) {
    map.set(t.date, t.name);
  }

  for (const g of groups) {
    if (!g.substitutable) continue;
    const overlapsWeekend = g.dates.some((d) => {
      const dow = dayOfWeek(d);
      return dow === 0 || dow === 6;
    });
    const overlapsOtherHoliday =
      g.name.includes(" · ") || g.dates.some((d) => (claims.get(d)?.size ?? 0) > 1);
    if (!overlapsWeekend && !overlapsOtherHoliday) continue;

    let cursor = addDays(g.dates[g.dates.length - 1], 1);
    for (let i = 0; i < 14; i++) {
      const dow = dayOfWeek(cursor);
      if (dow !== 0 && dow !== 6 && !claims.has(cursor)) {
        map.set(cursor, `${g.name} 대체공휴일`);
        claims.set(cursor, new Set([`${g.name} 대체공휴일`]));
        break;
      }
      cursor = addDays(cursor, 1);
    }
  }

  return map;
}

const HOLIDAY_MAP = buildHolidayMap();

export function getHolidayName(dateStr: string): string | undefined {
  return HOLIDAY_MAP.get(dateStr);
}
