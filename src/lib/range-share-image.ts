// "공유 이미지" — 목록에서 끌어 고른 칸을 메신저(카톡 등)에서 폰으로 바로 읽기 좋은 카드 그림(PNG)으로 만든다.
// 한 줄 = 카드 한 장: 맨 위에 거래일자·거래처(출고처/공급처)를 항상 넣고, 고른 칸은 이름표와 함께 한 줄씩 보여준다.
// 엑셀에 붙일 표·글자는 grid-range-copy.ts가 따로 담는다 — 여기는 그림만 만든다.

export type ShareRow = { date: string; party: string; values: string[] };
export type ShareData = { title: string; sub: string; labels: string[]; rows: ShareRow[]; total: { label: string; value: number } | null; hiddenRows: number };

const WIDTH = 360;
const PAD = 16;
const LABEL_W = 76;
export const SHARE_MAX_ROWS = 30;

const DATE_HEAD = /^(거래일자|일자|날짜|작성일|발행일|기준일)/;
const PARTY_HEAD = /^(출고처|공급처|거래처|고객|납품처)/;
const TOTAL_HEAD = [/^공급가액/, /^합계/, /^금액/];

export const isDateHead = (h: string) => DATE_HEAD.test(h.trim());
export const isPartyHead = (h: string) => PARTY_HEAD.test(h.trim());
export const findTotalLabel = (labels: string[]) => {
  for (const re of TOTAL_HEAD) {
    const i = labels.findIndex((l) => re.test(l.trim()));
    if (i >= 0) return i;
  }
  return -1;
};

export function parseAmount(v: string): number | null {
  const m = v.replace(/,/g, "").match(/^\s*([-+]?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// 수량·금액 같은 숫자 항목만 오른쪽 정렬한다(규격 '39'처럼 이름 대신 쓰는 숫자는 왼쪽)
const RIGHT_LABEL = /수량|단가|금액|가액|세액|합계|중량|잔액|잔량|매수/;
const looksNumeric = (v: string) => /^[-+]?[\d,]+(\.\d+)?(\s?[A-Za-z가-힣]{1,4})?$/.test(v.trim());

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export function renderSharePng(d: ShareData): Promise<Blob | null> {
  try {
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--erp-primary").trim() || "#2563eb";
    const text = css.getPropertyValue("--erp-text").trim() || "#1b2a3a";
    const family = getComputedStyle(document.body).fontFamily || "sans-serif";
    const fieldCount = d.labels.length;
    const headH = 58;
    const rowH = 12 + 26 + fieldCount * 22 + 8;
    const footH = d.total ? 48 : 34;
    const height = headH + d.rows.length * rowH + (d.hiddenRows ? 26 : 0) + footH;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.scale(scale, scale);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, height);

    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, WIDTH, headH);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 16px ${family}`;
    ctx.textAlign = "left";
    ctx.fillText(fit(ctx, d.title, WIDTH - PAD * 2), PAD, 22);
    ctx.font = `400 12px ${family}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(d.sub, PAD, 42);
    ctx.globalAlpha = 1;

    let y = headH;
    for (const row of d.rows) {
      ctx.strokeStyle = "#e3e7ee";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + rowH - 0.5);
      ctx.lineTo(WIDTH - PAD, y + rowH - 0.5);
      ctx.stroke();
      const top = y + 12 + 13;
      ctx.textAlign = "left";
      ctx.fillStyle = "#5b6676";
      ctx.font = `700 13px ${family}`;
      ctx.fillText(row.date, PAD, top);
      ctx.textAlign = "right";
      ctx.fillStyle = text;
      ctx.font = `700 14px ${family}`;
      ctx.fillText(fit(ctx, row.party, WIDTH - PAD * 2 - 96), WIDTH - PAD, top);
      row.values.forEach((v, i) => {
        const ly = y + 12 + 26 + i * 22 + 11;
        ctx.textAlign = "left";
        ctx.fillStyle = "#8590a0";
        ctx.font = `400 12px ${family}`;
        ctx.fillText(fit(ctx, d.labels[i], LABEL_W - 6), PAD, ly);
        ctx.fillStyle = text;
        ctx.font = `600 13px ${family}`;
        if (RIGHT_LABEL.test(d.labels[i]) && looksNumeric(v)) {
          ctx.textAlign = "right";
          ctx.fillText(v, WIDTH - PAD, ly);
        } else {
          ctx.fillText(fit(ctx, v || "-", WIDTH - PAD * 2 - LABEL_W), PAD + LABEL_W, ly);
        }
      });
      y += rowH;
    }
    if (d.hiddenRows) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#8590a0";
      ctx.font = `400 12px ${family}`;
      ctx.fillText(`… 외 ${d.hiddenRows}건 (이미지에는 ${SHARE_MAX_ROWS}건까지)`, PAD, y + 13);
      y += 26;
    }
    ctx.fillStyle = "#f3f5f8";
    ctx.fillRect(0, y, WIDTH, footH);
    ctx.fillStyle = text;
    ctx.textAlign = "left";
    ctx.font = `700 14px ${family}`;
    const countAll = d.rows.length + d.hiddenRows;
    ctx.fillText(d.total ? `${d.total.label} 합계 (${countAll}건)` : `총 ${countAll}건`, PAD, y + footH / 2);
    if (d.total) {
      ctx.textAlign = "right";
      ctx.fillText(`${d.total.value.toLocaleString("ko-KR")}원`, WIDTH - PAD, y + footH / 2);
    }
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    return Promise.resolve(null);
  }
}
