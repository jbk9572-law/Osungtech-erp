"use client";

import { useId, useMemo, useState } from "react";
import { matchesSearch } from "@/lib/search-match";

type Item = { id: string; name: string };

// 여러 개를 체크로 고르는 목록(예: 견적요청의 공급처) — 검색 + 보이는 항목 전체 선택 + "N곳 선택됨".
// 항목이 수십~수백 개가 되어도 원하는 것을 찾아 고를 수 있게 한다(예전엔 높이 160px 목록을 스크롤만 했다).
// 선택 상태는 호출부가 들고 있다(selected/onChange) — 이 부품은 표시·입력만 한다.
export function CheckListPicker({
  items,
  selected,
  onChange,
  unit = "곳",
  searchPlaceholder = "이름 검색",
  emptyText = "항목이 없습니다.",
  ariaLabel,
}: {
  items: Item[];
  selected: string[];
  onChange: (ids: string[]) => void;
  unit?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel: string;
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();
  const visible = useMemo(() => (keyword ? items.filter((i) => matchesSearch(keyword, i.name)) : items), [items, keyword]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allVisibleSelected = visible.length > 0 && visible.every((i) => selectedSet.has(i.id));

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }
  function toggleAllVisible() {
    if (allVisibleSelected) {
      const hide = new Set(visible.map((i) => i.id));
      onChange(selected.filter((s) => !hide.has(s)));
    } else {
      const add = visible.filter((i) => !selectedSet.has(i.id)).map((i) => i.id);
      onChange([...selected, ...add]);
    }
  }

  return (
    <div className="erp-checklist" role="group" aria-label={ariaLabel}>
      <div className="erp-checklist-bar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Enter가 폼 제출로 번지지 않게(검색칸에서 Enter는 아무 일도 하지 않는다)
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={searchPlaceholder}
          aria-label={`${ariaLabel} 검색`}
          className="erp-input erp-checklist-search"
        />
        <button type="button" className="erp-btn erp-btn-sm" onClick={toggleAllVisible} disabled={visible.length === 0}>
          {allVisibleSelected ? "보이는 항목 해제" : "보이는 항목 모두 선택"}
        </button>
        <button type="button" className="erp-btn erp-btn-sm" onClick={() => onChange([])} disabled={selected.length === 0}>
          선택 지우기
        </button>
        <span className="erp-checklist-count" role="status">
          <b>{selected.length}</b>
          {unit} 선택됨
        </span>
      </div>
      <ul className="erp-checklist-list">
        {visible.map((i) => {
          const checkId = `${uid}-${i.id}`;
          return (
            <li key={i.id}>
              <label htmlFor={checkId} className="erp-checklist-row">
                <input id={checkId} type="checkbox" checked={selectedSet.has(i.id)} onChange={() => toggle(i.id)} />
                <span>{i.name}</span>
              </label>
            </li>
          );
        })}
        {visible.length === 0 && <li className="erp-checklist-empty">{items.length === 0 ? emptyText : "검색 결과가 없습니다."}</li>}
      </ul>
    </div>
  );
}
