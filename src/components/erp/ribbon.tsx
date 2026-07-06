"use client";

import { useRouter } from "next/navigation";

export function Ribbon() {
  const router = useRouter();

  return (
    <div className="erp-ribbon">
      <button type="button" className="erp-ribbon-btn" onClick={() => router.refresh()}>
        ↻ 새로고침
      </button>
      <button type="button" className="erp-ribbon-btn" disabled>
        ★ 즐겨찾기
      </button>
      <button type="button" className="erp-ribbon-btn" disabled>
        🕘 최근 메뉴
      </button>
      <button type="button" className="erp-ribbon-btn" disabled>
        🔍 빠른 검색
      </button>
      <button type="button" className="erp-ribbon-btn" disabled>
        ? 도움말
      </button>
    </div>
  );
}
