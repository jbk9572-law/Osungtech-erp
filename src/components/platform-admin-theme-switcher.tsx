"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "erp-theme";
const THEMES = [
  { value: "classic-light", label: "Classic Light (기본)" },
  { value: "modern", label: "Modern" },
] as const;
type ThemeValue = (typeof THEMES)[number]["value"];

function applyTheme(value: ThemeValue) {
  if (value === "modern") {
    document.documentElement.setAttribute("data-theme", value);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// 스위치 자체는 플랫폼관리자 > 환경설정에만 있지만("다크모드를 저
// 메뉴가아니라 플랫폼 전체관리자페이지에 넣어주라는거고"), 적용 범위는
// 이 브라우저로 보는 앱 전체다(메신저/매입/매출 등 — 사용자가 올린 목업
// 12개가 전부 테넌트 ERP 화면이었다: "내가준 html파일 어디도 다크모드로
// 안되어있을건데?"). layout.tsx의 인라인 스크립트가 첫 페인트 전에
// data-theme을 미리 붙여주지만, 이 드롭다운 자체는 "지금 뭐가 선택돼
// 있는지"를 보여줘야 해서 localStorage를 다시 읽는다 — 서버 렌더링
// 시점엔 이 값을 알 수 없으므로(브라우저별로 다름) mount 이후에만 채운다.
export function PlatformAdminThemeSwitcher() {
  const [value, setValue] = useState<ThemeValue>("classic-light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
      if (stored === "modern") setValue(stored);
    } catch {
      // 프라이빗 모드 등으로 못 읽어도 기본값(라이트)으로 둔다.
    }
  }, []);

  function handleChange(next: ThemeValue) {
    setValue(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // 저장이 안 돼도(프라이빗 모드 등) 지금 화면에는 바로 반영된다 —
      // 다음에 새로 열 때만 다시 기본값으로 돌아간다.
    }
  }

  return (
    <div className="erp-field" style={{ maxWidth: 360 }}>
      <label htmlFor="pa-theme-select">테마</label>
      <select
        id="pa-theme-select"
        className="erp-select"
        value={value}
        onChange={(e) => handleChange(e.target.value as ThemeValue)}
      >
        {THEMES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
