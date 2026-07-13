"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MENU_ITEMS } from "@/lib/erp-menu";
import { getFavorites, getRecentMenus, toggleFavorite } from "@/lib/erp-menu-history";

const SHORTCUTS: { key: string; label: string }[] = [
  { key: "F2", label: "신규" },
  { key: "F3", label: "상세조회" },
  { key: "F4", label: "수정" },
  { key: "F5", label: "조회" },
  { key: "F6", label: "삭제" },
  { key: "F7", label: "저장" },
  { key: "F8", label: "엑셀" },
  { key: "F9", label: "출력" },
  { key: "ESC", label: "닫기" },
  { key: "Ctrl+S", label: "저장" },
  { key: "Ctrl+F", label: "검색" },
  { key: "Ctrl+P", label: "출력" },
];

function labelFor(href: string) {
  return MENU_ITEMS.find((m) => m.href === href)?.label ?? href;
}

export function Ribbon() {
  const router = useRouter();
  const [openPanel, setOpenPanel] = useState<"favorites" | "recent" | null>(null);
  const [modal, setModal] = useState<"search" | "help" | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  // 모바일에서 리본이 가로 스크롤(overflow-x: auto)되게 하다 보니, 드롭다운을
  // 예전처럼 버튼 기준 position:absolute로 두면 리본 바깥으로 나가는 부분이
  // 잘려서 안 보이는 문제가 생긴다. document.body에 포털로 렌더링하고
  // 버튼의 화면 좌표를 계산해 position:fixed로 붙여서 이 문제를 피한다.
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpenPanel(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModal(null);
        setOpenPanel(null);
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  function openFavorites(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPanelPos({ top: rect.bottom, left: rect.left });
    setFavorites(getFavorites());
    setOpenPanel((p) => (p === "favorites" ? null : "favorites"));
  }

  function openRecents(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPanelPos({ top: rect.bottom, left: rect.left });
    setRecents(getRecentMenus());
    setOpenPanel((p) => (p === "recent" ? null : "recent"));
  }

  function renderDropdown(content: React.ReactNode) {
    if (!panelPos || typeof document === "undefined") return null;
    return createPortal(
      <div
        ref={dropdownRef}
        className="erp-ribbon-dropdown"
        style={{ position: "fixed", top: panelPos.top, left: panelPos.left }}
      >
        {content}
      </div>,
      document.body
    );
  }

  function handleToggleFavorite(href: string) {
    setFavorites(toggleFavorite(href));
  }

  const filteredMenus = MENU_ITEMS.filter((m) =>
    m.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="erp-ribbon" ref={wrapRef}>
      <button
        type="button"
        className="erp-ribbon-btn"
        onClick={() => window.location.reload()}
      >
        ↻ 새로고침
      </button>

      <button type="button" className="erp-ribbon-btn" onClick={openFavorites}>
        ★ 즐겨찾기
      </button>
      {openPanel === "favorites" &&
        renderDropdown(
          favorites.length ? (
            favorites.map((href) => (
              <div key={href} className="erp-ribbon-dropdown-item">
                <button type="button" onClick={() => router.push(href)}>
                  {labelFor(href)}
                </button>
                <span className="erp-ribbon-star active" onClick={() => handleToggleFavorite(href)}>
                  ★
                </span>
              </div>
            ))
          ) : (
            <p className="erp-ribbon-dropdown-empty">
              최근 메뉴 목록에서 ☆를 눌러 즐겨찾기를 추가하세요.
            </p>
          )
        )}

      <button type="button" className="erp-ribbon-btn" onClick={openRecents}>
        🕘 최근 메뉴
      </button>
      {openPanel === "recent" &&
        renderDropdown(
          recents.length ? (
            recents.map((href) => {
              const isFav = favorites.includes(href) || getFavorites().includes(href);
              return (
                <div key={href} className="erp-ribbon-dropdown-item">
                  <button type="button" onClick={() => router.push(href)}>
                    {labelFor(href)}
                  </button>
                  <span
                    className={`erp-ribbon-star${isFav ? " active" : ""}`}
                    onClick={() => handleToggleFavorite(href)}
                  >
                    {isFav ? "★" : "☆"}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="erp-ribbon-dropdown-empty">최근 방문한 메뉴가 없습니다.</p>
          )
        )}

      <button
        type="button"
        className="erp-ribbon-btn"
        onClick={() => {
          setQuery("");
          setModal("search");
        }}
      >
        🔍 빠른 검색
      </button>

      <button type="button" className="erp-ribbon-btn" onClick={() => setModal("help")}>
        ? 도움말
      </button>

      {modal === "search" && (
        <div className="erp-modal-overlay" onClick={() => setModal(null)}>
          <div className="erp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="erp-modal-title">
              빠른 검색
              <button type="button" className="erp-modal-close" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>
            <div className="erp-modal-body">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="메뉴 이름으로 검색..."
                className="erp-input"
                style={{ width: "100%", marginBottom: 8 }}
              />
              <div className="erp-ribbon-searchlist">
                {filteredMenus.map((m) => (
                  <button
                    key={m.href}
                    type="button"
                    className="erp-ribbon-searchitem"
                    onClick={() => {
                      router.push(m.href);
                      setModal(null);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
                {!filteredMenus.length && (
                  <p className="erp-ribbon-dropdown-empty">검색 결과가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === "help" && (
        <div className="erp-modal-overlay" onClick={() => setModal(null)}>
          <div className="erp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="erp-modal-title">
              단축키 도움말
              <button type="button" className="erp-modal-close" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>
            <div className="erp-modal-body">
              <table className="erp-grid" style={{ width: "100%" }}>
                <tbody>
                  {SHORTCUTS.map((s) => (
                    <tr key={s.key}>
                      <td style={{ fontWeight: 700, width: 90 }}>{s.key}</td>
                      <td>{s.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
