"use client";

import { useEffect, useState } from "react";
import { PLATFORM_ADMIN_THEME_CHANGE_EVENT, PLATFORM_ADMIN_THEME_KEY } from "@/components/platform-admin-theme-shell";

const THEMES = [
  { value: "classic-light", label: "Classic Light (기본)" },
  { value: "modern", label: "Modern" },
] as const;
type ThemeValue = (typeof THEMES)[number]["value"];

// platform-admin-theme-shell.tsx가 마운트 시/이벤트 수신 시 localStorage를
// 다시 읽어 .pa-theme-modern 클래스를 켜고 끈다 — 이 드롭다운은 그
// localStorage 값을 쓰고, 같은 탭 안에서 바로 반영되도록 커스텀 이벤트를
// 쏜다(storage 이벤트는 다른 탭에서만 발생해 같은 탭엔 안 옴).
export function PlatformAdminThemeSwitcher() {
  const [value, setValue] = useState<ThemeValue>("classic-light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLATFORM_ADMIN_THEME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
      if (stored === "modern") setValue(stored);
    } catch {
      // 프라이빗 모드 등으로 못 읽어도 기본값(라이트)으로 둔다.
    }
  }, []);

  function handleChange(next: ThemeValue) {
    setValue(next);
    try {
      localStorage.setItem(PLATFORM_ADMIN_THEME_KEY, next);
    } catch {
      // 저장이 안 돼도(프라이빗 모드 등) 지금 탭에는 이벤트로 바로 반영된다 —
      // 다음에 새로 열 때만 다시 기본값으로 돌아간다.
    }
    window.dispatchEvent(new Event(PLATFORM_ADMIN_THEME_CHANGE_EVENT));
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
