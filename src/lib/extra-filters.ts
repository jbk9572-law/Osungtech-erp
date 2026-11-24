// 목록의 "추가 조건"(출고처/공급처·규격) 걸러내기 — 사용자 정의 필터(ExtraFilters)가 보낸 party·spec 값을 매출·매입 목록이 같이 쓴다.
// 비어 있으면 아무것도 거르지 않는다(null 필터). 검색어(q)와 별개로, 둘 다 걸려 있으면 모두 만족해야 보인다.
export function buildExtraFilter(party?: string, spec?: string): ((partyName?: string | null, specText?: string | null) => boolean) | null {
  const p = party?.trim().toLowerCase();
  const s = spec?.trim().toLowerCase();
  if (!p && !s) return null;
  return (partyName, specText) => (!p || (partyName ?? "").toLowerCase().includes(p)) && (!s || (specText ?? "").toLowerCase().includes(s));
}
