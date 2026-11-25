// 표에서 끌어서 고른 칸 범위를 클립보드로 — 스프레드시트처럼 어디에 붙여넣어도 알맞은 모양이 되게 세 가지 형식을 한꺼번에 담는다.
//   · text/plain  탭으로 나눈 글자(TSV) — 메모장·메신저 글자 붙여넣기, 엑셀/구글시트
//   · text/html   <table> — 엑셀·구글시트·워드·한글에서 표 모양 그대로
//   · image/png   표 그림 — 카카오톡·슬랙·문서 등 그림을 붙여넣는 곳
// 표의 칸은 입력칸(input)이라 화면에 보이는 값(input.value)을 읽는다. 그림은 선택 범위 위에 해당 열의 머리글 줄을 붙여 그린다.

import { parseShareItems, shareItemValue } from "@/lib/share-items";
import { cellAtX, cellCenterX, headerCellAtX } from "@/lib/grid-range-select";
import { findTotalLabel, isDateHead, isPartyHead, parseAmount, renderSharePng, SHARE_MAX_ROWS, type ShareData } from "@/lib/range-share-image";

export type RangeMatrix = { header: string[]; rows: string[][] };

function cellText(td: HTMLTableCellElement): string {
  const input = td.querySelector('input:not([type="checkbox"]):not([type="hidden"])') as HTMLInputElement | null;
  if (input) return input.value;
  const clone = td.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button").forEach((el) => el.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 고른 칸들(줄마다 한 묶음)을 머리글과 함께 읽는다. 머리글은 첫 줄의 칸 위치에 맞는 머리글 칸에서 가져온다. */
export function readCells(table: HTMLTableElement, rows: HTMLTableCellElement[][]): RangeMatrix {
  const first = rows[0] ?? [];
  const header = first.map((td) => (headerCellAtX(table, cellCenterX(td))?.textContent ?? "").trim());
  return { header, rows: rows.map((r) => r.map((td) => cellText(td))) };
}

export function toTsv(m: RangeMatrix): string {
  const clean = (v: string) => v.replace(/[\t\r\n]+/g, " ");
  return m.rows.map((r) => r.map(clean).join("\t")).join("\n");
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function toHtml(m: RangeMatrix): string {
  const th = m.header.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = m.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");
  return `<table border="1" cellspacing="0" cellpadding="4"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

/** 선택 범위를 그림(PNG)으로 — 화면에 보이는 칸 크기·글자 모양을 그대로 따라 그린다. 그릴 수 없으면 null. */
export function renderRangePng(table: HTMLTableElement, rows: HTMLTableCellElement[][]): Promise<Blob | null> {
  try {
    const first = rows[0];
    if (!first || first.length === 0) return Promise.resolve(null);
    const heads = first.map((td) => headerCellAtX(table, cellCenterX(td)));
    const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
    const widths = first.map((td) => Math.ceil(td.getBoundingClientRect().width));
    const bodyHeights = rows.map((r) => Math.ceil(r[0].parentElement!.getBoundingClientRect().height));
    const headH = headRow ? Math.ceil(headRow.getBoundingClientRect().height) : 0;
    const totalW = widths.reduce((a, b) => a + b, 0);
    const totalH = headH + bodyHeights.reduce((a, b) => a + b, 0);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalW, totalH);
    const drawCell = (td: HTMLTableCellElement | null, text: string, x: number, y: number, w: number, h: number, isHead: boolean) => {
      if (!td) return;
      const st = getComputedStyle(td);
      if (isHead && st.backgroundColor !== "rgba(0, 0, 0, 0)" && st.backgroundColor !== "transparent") {
        ctx.fillStyle = st.backgroundColor;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = st.borderBottomColor || "#d3d8e0";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      const input = td.querySelector("input");
      const fs = input ? getComputedStyle(input) : st;
      ctx.font = `${isHead ? "700" : fs.fontWeight} ${fs.fontSize} ${fs.fontFamily}`;
      ctx.fillStyle = isHead ? st.color : fs.color;
      ctx.textBaseline = "middle";
      const align = (input ? fs.textAlign : st.textAlign) === "right" || td.classList.contains("num") ? "right" : "left";
      ctx.textAlign = align;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 1, y, w - 2, h);
      ctx.clip();
      ctx.fillText(text, align === "right" ? x + w - 8 : x + 8, y + h / 2);
      ctx.restore();
    };
    let y = 0;
    if (headRow) {
      let x = 0;
      heads.forEach((th, ci) => {
        drawCell(th, (th?.textContent ?? "").trim(), x, y, widths[ci], headH, true);
        x += widths[ci];
      });
      y += headH;
    }
    rows.forEach((r, ri) => {
      let x = 0;
      r.forEach((td, ci) => {
        drawCell(td, cellText(td), x, y, widths[ci] ?? td.getBoundingClientRect().width, bodyHeights[ri], false);
        x += widths[ci] ?? 0;
      });
      y += bodyHeights[ri];
    });
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    return Promise.resolve(null);
  }
}

/** 목록용 "공유 이미지" 재료 — 날짜·거래처 열은 고르지 않았어도 항상 넣고, 나머지 고른 칸은 이름표와 함께 둔다. */
export function readShareData(table: HTMLTableElement, picked: HTMLTableCellElement[][]): ShareData {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  const headCells = Array.from(headRow?.cells ?? []);
  const textOf = (th: HTMLTableCellElement) => (th.textContent ?? "").trim();
  const dateTh = headCells.find((th) => isDateHead(textOf(th))) ?? null;
  const partyTh = headCells.find((th) => isPartyHead(textOf(th))) ?? null;
  const first = picked[0] ?? [];
  const keepIdx: number[] = [];
  first.forEach((td, i) => {
    const th = headerCellAtX(table, cellCenterX(td));
    if (th && (th === dateTh || th === partyTh)) return;
    keepIdx.push(i);
  });
  const labels = keepIdx.map((i) => (headerCellAtX(table, cellCenterX(first[i]))?.textContent ?? "").trim());
  const itemLevel = labels.map((l) => shareItemValue(l, { p: "", s: "", l: "", r: "", q: "", u: "", a: "", t: "" }) !== null);
  const rows: ShareData["rows"] = picked.map((cells) => {
    const tr = cells[0].parentElement as HTMLTableRowElement;
    const at = (th: HTMLTableCellElement | null) => {
      const td = th ? cellAtX(tr, cellCenterX(th)) : null;
      return td ? cellText(td) : "";
    };
    const values = keepIdx.map((i) => (cells[i] ? cellText(cells[i]) : ""));
    // "외 N건" 전표: 드래그한 열 가운데 품목 단위 열(품명·규격·수량·단가·금액…)은 품목마다 펼친다. 고르지 않은 열은 품목 줄에도 나오지 않는다.
    const items = parseShareItems(tr.dataset.shareItems);
    const expanded = items && itemLevel.some(Boolean) ? items.map((it) => ({ values: labels.map((l) => shareItemValue(l, it) ?? "") })) : undefined;
    return { date: at(dateTh).replace(/\s+/g, ""), party: at(partyTh), values, items: expanded };
  });
  const ti = findTotalLabel(labels);
  let total: ShareData["total"] = null;
  if (ti >= 0) {
    total = { label: labels[ti], value: rows.reduce((sum, row) => sum + (parseAmount(row.values[ti]) ?? 0), 0) };
  }
  const title = (document.querySelector(".erp-h1")?.textContent ?? document.title ?? "목록").trim() || "목록";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).replace(/-/g, ".");
  const hiddenRows = Math.max(0, rows.length - SHARE_MAX_ROWS);
  return { title, sub: `${today} 기준 · ${rows.length}건`, labels, itemLevel, rows: rows.slice(0, SHARE_MAX_ROWS), total, hiddenRows };
}

/** 세 형식으로 클립보드에 쓴다. 그림이 안 되는 브라우저면 글자·표만, 그것도 안 되면 글자만. 성공 여부를 돌려준다. */
export async function copyRange(table: HTMLTableElement, rows: HTMLTableCellElement[][], mode: "table" | "share" = "table"): Promise<{ ok: boolean; image: boolean }> {
  const m = readCells(table, rows);
  const text = new Blob([toTsv(m)], { type: "text/plain" });
  const html = new Blob([toHtml(m)], { type: "text/html" });
  const png = mode === "share" ? renderSharePng(readShareData(table, rows)) : renderRangePng(table, rows);
  try {
    const pngBlob = await png;
    const items: Record<string, Blob> = { "text/plain": text, "text/html": html };
    if (pngBlob) items["image/png"] = pngBlob;
    await navigator.clipboard.write([new ClipboardItem(items)]);
    return { ok: true, image: !!pngBlob };
  } catch {
    try {
      await navigator.clipboard.writeText(toTsv(m));
      return { ok: true, image: false };
    } catch {
      return { ok: false, image: false };
    }
  }
}
