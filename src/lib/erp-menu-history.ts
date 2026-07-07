"use client";

// 즐겨찾기 / 최근 메뉴 — localStorage에 저장 (서버 저장소 없이도 동작하는
// 가벼운 개인화 기능). 브라우저 전용이라 window 존재 여부를 확인한다.

const FAVORITES_KEY = "nest-erp-favorites";
const RECENTS_KEY = "nest-erp-recent-menus";
const RECENTS_LIMIT = 8;

function readList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(list));
}

export function getFavorites(): string[] {
  return readList(FAVORITES_KEY);
}

export function toggleFavorite(href: string): string[] {
  const current = readList(FAVORITES_KEY);
  const next = current.includes(href)
    ? current.filter((h) => h !== href)
    : [...current, href];
  writeList(FAVORITES_KEY, next);
  return next;
}

export function getRecentMenus(): string[] {
  return readList(RECENTS_KEY);
}

export function pushRecentMenu(href: string): string[] {
  const current = readList(RECENTS_KEY).filter((h) => h !== href);
  const next = [href, ...current].slice(0, RECENTS_LIMIT);
  writeList(RECENTS_KEY, next);
  return next;
}
