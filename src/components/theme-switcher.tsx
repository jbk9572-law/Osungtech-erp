"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "erp-theme";
const THEMES = [
  { value: "classic-light", label: "Classic Light ERP (기본)" },
  { value: "dark-command", label: "Modern Dark Command Center" },
] as const;
type ThemeValue = (typeof THEMES)[number]["value"];

function applyTheme(value: ThemeValue) {
  if (value === "dark-command") {
    document.documentElement.setAttribute("data-theme", value);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// layout.tsx의 인라인 스크립트가 첫 페인트 전에 data-theme을 미리
// 붙여주지만, 이 드롭다운 자체는 "지금 뭐가 선택돼 있는지"를 보여줘야
// 해서 localStorage를 다시 읽는다 — 서버 렌더링 시점엔 이 값을 알 수
// 없으므로(브라우저별로 다름) mount 이후에만 채운다.
export function ThemeSwitcher() {
  const [value, setValue] = useState<ThemeValue>("classic-light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
      if (stored === "dark-command") setValue(stored);
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
      <label htmlFor="theme-select">테마</label>
      <select
        id="theme-select"
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
