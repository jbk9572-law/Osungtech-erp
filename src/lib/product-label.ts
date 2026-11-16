// 품목 선택창(검색 드롭다운·콤보박스)에 보이는 이름은 한 곳에서 만든다 — 같은 품명이 규격만 다른
// 경우가 많아서, 품명만 보이면 어떤 품목인지 헷갈린다(화면마다 따로 조립하다 규격이 빠진 전례가 있음).
type LabelProduct = { sku?: string; name: string; spec?: string | null };

// "품명 (규격)"
export function productLabel(p: LabelProduct): string {
  return p.spec ? `${p.name} (${p.spec})` : p.name;
}

// "코드 · 품명 (규격)" — 코드로도 구분해야 하는 ErpSelect 목록용
export function productOptionLabel(p: LabelProduct & { sku: string }): string {
  return `${p.sku} · ${productLabel(p)}`;
}
