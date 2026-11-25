// 표에서 끌어서 고른 칸 범위를 클립보드로 — 스프레드시트처럼 어디에 붙여넣어도 알맞은 모양이 되게 세 가지 형식을 한꺼번에 담는다.
//   · text/plain  탭으로 나눈 글자(TSV) — 메모장·메신저 글자 붙여넣기, 엑셀/구글시트
//   · text/html   <table> — 엑셀·구글시트·워드·한글에서 표 모양 그대로
//   · image/png   표 그림 — 카카오톡·슬랙·문서 등 그림을 붙여넣는 곳
// 표의 칸은 입력칸(input)이라 화면에 보이는 값(input.value)을 읽는다. 그림은 선택 범위 위에 해당 열의 머리글 줄을 붙여 그린다.

import { findTotalLabel, isDateHead, isPartyHead, parseAmount, renderSharePng, SHARE_MAX_ROWS, type ShareData } from "@/lib/range-share-image";

export type RangeMatrix = { header: string[]; rows: string[][] };

function cellText(td: HTMLTableCellElement): string {
  const input = td.querySelector('input:not([type="checkbox"]):not([type="hidden"])') as HTMLInputElement | null;
  if (input) return input.value;
  const clone = td.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button").forEach((el) => el.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function readRange(table: HTMLTableElement, r1: number, r2: number, c1: number, c2: number): RangeMatrix {
  const body = table.tBodies[0];
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  const header: string[] = [];
  const rows: string[][] = [];
  const visibleCols: number[] = [];
  for (let c = c1; c <= c2; c++) {
    const h = headRow?.cells[c];
    const probe = body?.rows[r1]?.cells[c];
    if (probe && !probe.offsetParent) continue; // 숨긴 칸은 빼고
    visibleCols.push(c);
    header.push(h ? (h.textContent ?? "").trim() : "");
  }
  for (let r = r1; r <= r2; r++) {
    const tr = body?.rows[r];
    if (!tr) continue;
    rows.push(visibleCols.map((c) => (tr.cells[c] ? cellText(tr.cells[c]) : "")));
  }
  return { header, rows };
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
export function renderRangePng(table: HTMLTableElement, r1: number, r2: number, c1: number, c2: number): Promise<Blob | null> {
  try {
    const body = table.tBodies[0];
    const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
    const cols: number[] = [];
    for (let c = c1; c <= c2; c++) if (body?.rows[r1]?.cells[c]?.offsetParent) cols.push(c);
    if (!body || cols.length === 0) return Promise.resolve(null);
    const trs: HTMLTableRowElement[] = [];
    if (headRow) trs.push(headRow);
    for (let r = r1; r <= r2; r++) if (body.rows[r]) trs.push(body.rows[r]);
    const widths = cols.map((c) => Math.ceil(body.rows[r1].cells[c].getBoundingClientRect().width));
    const heights = trs.map((tr) => Math.ceil(tr.getBoundingClientRect().height));
    const totalW = widths.reduce((a, b) => a + b, 0);
    const totalH = heights.reduce((a, b) => a + b, 0);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalW, totalH);
    let y = 0;
    trs.forEach((tr, ri) => {
      let x = 0;
      cols.forEach((c, ci) => {
        const td = tr.cells[c];
        const w = widths[ci];
        const h = heights[ri];
        if (td) {
          const st = getComputedStyle(td);
          const isHead = tr === headRow;
          const bg = isHead ? st.backgroundColor : "rgba(0,0,0,0)";
          if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
            ctx.fillStyle = bg;
            ctx.fillRect(x, y, w, h);
          }
          ctx.strokeStyle = st.borderBottomColor || "#d3d8e0";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
          const text = isHead ? (td.textContent ?? "").trim() : cellText(td);
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
        }
        x += w;
      });
      y += heights[ri];
    });
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    return Promise.resolve(null);
  }
}

/** 목록용 "공유 이미지" 재료 — 날짜·거래처 열은 고르지 않았어도 항상 넣고, 나머지 고른 칸은 이름표와 함께 둔다. */
export function readShareData(table: HTMLTableElement, r1: number, r2: number, c1: number, c2: number): ShareData {
  const body = table.tBodies[0];
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  const headOf = (c: number) => (headRow?.cells[c]?.textContent ?? "").trim();
  const colCount = headRow?.cells.length ?? 0;
  let dateCol = -1;
  let partyCol = -1;
  for (let c = 0; c < colCount; c++) {
    if (dateCol < 0 && isDateHead(headOf(c))) dateCol = c;
    if (partyCol < 0 && isPartyHead(headOf(c))) partyCol = c;
  }
  const cols: number[] = [];
  for (let c = c1; c <= c2; c++) {
    if (c === dateCol || c === partyCol) continue;
    if (body?.rows[r1]?.cells[c]?.offsetParent) cols.push(c);
  }
  const labels = cols.map(headOf);
  const rows: ShareData["rows"] = [];
  for (let r = r1; r <= r2; r++) {
    const tr = body?.rows[r];
    if (!tr) continue;
    const at = (c: number) => (c >= 0 && tr.cells[c] ? cellText(tr.cells[c]) : "");
    rows.push({ date: at(dateCol).replace(/\s+/g, ""), party: at(partyCol), values: cols.map((c) => at(c)) });
  }
  const ti = findTotalLabel(labels);
  let total: ShareData["total"] = null;
  if (ti >= 0) {
    total = { label: labels[ti], value: rows.reduce((sum, row) => sum + (parseAmount(row.values[ti]) ?? 0), 0) };
  }
  const title = (document.querySelector(".erp-h1")?.textContent ?? document.title ?? "목록").trim() || "목록";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).replace(/-/g, ".");
  const hiddenRows = Math.max(0, rows.length - SHARE_MAX_ROWS);
  return { title, sub: `${today} 기준 · ${rows.length}건`, labels, rows: rows.slice(0, SHARE_MAX_ROWS), total, hiddenRows };
}

/** 세 형식으로 클립보드에 쓴다. 그림이 안 되는 브라우저면 글자·표만, 그것도 안 되면 글자만. 성공 여부를 돌려준다. */
export async function copyRange(table: HTMLTableElement, r1: number, r2: number, c1: number, c2: number, mode: "table" | "share" = "table"): Promise<{ ok: boolean; image: boolean }> {
  const m = readRange(table, r1, r2, c1, c2);
  const text = new Blob([toTsv(m)], { type: "text/plain" });
  const html = new Blob([toHtml(m)], { type: "text/html" });
  const png = mode === "share" ? renderSharePng(readShareData(table, r1, r2, c1, c2)) : renderRangePng(table, r1, r2, c1, c2);
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
