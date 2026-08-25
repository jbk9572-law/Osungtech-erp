"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MENU_ITEMS } from "@/lib/erp-menu";
import {
  getFavorites,
  getRecentMenus,
  toggleFavorite,
} from "@/lib/erp-menu-history";
import { startRouteProgress } from "@/lib/route-progress";

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
  { key: "Ctrl+K", label: "빠른 검색" },
  { key: "Ctrl+P", label: "출력" },
];

function labelFor(href: string) {
  return MENU_ITEMS.find((m) => m.href === href)?.label ?? href;
}

export function Ribbon() {
  const router = useRouter();
  const [openPanel, setOpenPanel] = useState<"favorites" | "recent" | null>(
    null,
  );
  const [modal, setModal] = useState<"search" | "help" | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  // 모바일에서 리본이 가로 스크롤(overflow-x: auto)되게 하다 보니, 드롭다운을
  // 예전처럼 버튼 기준 position:absolute로 두면 리본 바깥으로 나가는 부분이
  // 잘려서 안 보이는 문제가 생긴다. document.body에 포털로 렌더링하고
  // 버튼의 화면 좌표를 계산해 position:fixed로 붙여서 이 문제를 피한다.
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
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

  // Ctrl/Cmd+K로 어디서든 빠른 검색을 바로 열 수 있게 한다 — 메뉴 트리를
  // 마우스로 찾지 않고 타이핑만으로 원하는 화면으로 이동하는 용도.
  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setModal("search");
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
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
      document.body,
    );
  }

  function handleToggleFavorite(href: string) {
    setFavorites(toggleFavorite(href));
  }

  const filteredMenus = MENU_ITEMS.filter((m) =>
    m.label.toLowerCase().includes(query.trim().toLowerCase()),
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
                <button
                  type="button"
                  onClick={() => {
                    startRouteProgress();
                    router.push(href);
                  }}
                >
                  {labelFor(href)}
                </button>
                <button
                  type="button"
                  className="erp-ribbon-star active"
                  onClick={() => handleToggleFavorite(href)}
                  aria-label={`${labelFor(href)} 즐겨찾기 해제`}
                >
                  ★
                </button>
              </div>
            ))
          ) : (
            <p className="erp-ribbon-dropdown-empty">
              최근 메뉴 목록에서 ☆를 눌러 즐겨찾기를 추가하세요.
            </p>
          ),
        )}

      <button type="button" className="erp-ribbon-btn" onClick={openRecents}>
        🕘 최근 메뉴
      </button>
      {openPanel === "recent" &&
        renderDropdown(
          recents.length ? (
            recents.map((href) => {
              const isFav =
                favorites.includes(href) || getFavorites().includes(href);
              return (
                <div key={href} className="erp-ribbon-dropdown-item">
                  <button
                    type="button"
                    onClick={() => {
                      startRouteProgress();
                      router.push(href);
                    }}
                  >
                    {labelFor(href)}
                  </button>
                  <button
                    type="button"
                    className={`erp-ribbon-star${isFav ? " active" : ""}`}
                    onClick={() => handleToggleFavorite(href)}
                    aria-label={`${labelFor(href)} ${isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}`}
                  >
                    {isFav ? "★" : "☆"}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="erp-ribbon-dropdown-empty">
              최근 방문한 메뉴가 없습니다.
            </p>
          ),
        )}

      <button
        type="button"
        className="erp-ribbon-btn"
        title="Ctrl+K"
        onClick={() => {
          setQuery("");
          setModal("search");
        }}
      >
        🔍 빠른 검색{" "}
        <span style={{ opacity: 0.55, fontSize: 10.5 }}>Ctrl+K</span>
      </button>

      <button
        type="button"
        className="erp-ribbon-btn"
        onClick={() => setModal("help")}
      >
        ? 도움말
      </button>

      {modal === "search" && (
        <div className="erp-modal-overlay" onClick={() => setModal(null)}>
          <div className="erp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="erp-modal-title">
              빠른 검색
              <button
                type="button"
                className="erp-modal-close"
                onClick={() => setModal(null)}
                aria-label="닫기"
              >
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
                      startRouteProgress();
                      router.push(m.href);
                      setModal(null);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
                {!filteredMenus.length && (
                  <p className="erp-ribbon-dropdown-empty">
                    검색 결과가 없습니다.
                  </p>
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
              도움말
              <button
                type="button"
                className="erp-modal-close"
                onClick={() => setModal(null)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="erp-modal-body">
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--erp-text-muted)",
                  margin: "0 0 6px",
                }}
              >
                화면 구조
              </p>
              <ul
                style={{
                  fontSize: 12,
                  color: "var(--erp-text)",
                  margin: "0 0 16px",
                  paddingLeft: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <li>
                  왼쪽 트리메뉴에서 업무 화면을 고릅니다. Ctrl+K로 검색해 바로
                  이동할 수도 있어요.
                </li>
                <li>
                  연 화면은 위쪽 탭으로 계속 쌓이니, 여러 화면을 오가며 확인할
                  수 있습니다.
                </li>
                <li>
                  목록 화면 오른쪽 위의 버튼들은 아래 F키 단축키와 그대로
                  대응합니다.
                </li>
                <li>
                  물음표(?) 아이콘이 있는 항목에 마우스를 올리면 자세한 설명이
                  나옵니다.
                </li>
              </ul>
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--erp-text-muted)",
                  margin: "0 0 6px",
                }}
              >
                단축키
              </p>
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
