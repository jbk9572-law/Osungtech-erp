import { dateBandLabel, includedEntries, shareTotals, type ItemRole, type ShareEntry, type ShareItem, type ShareModel } from "@/lib/share-model";

// "공유 이미지"를 폰에서 바로 읽기 좋은 그림(PNG)으로 그린다 — 폭 360px 고정(메신저가 폰 화면 폭에 맞춰 보여준다).
//  · 날짜마다 파란 띠, 전표는 출고처 줄 + 품목.
//  · 품목의 열(품명 포함)이 4개 이하면 한 줄 표형(열 이름 줄 포함), 5~8개면 한 품목 두 줄. 줄이 길면 내려 쓴다.
//  · 한 장이 PAGE_H를 넘으면 여러 장으로 나눈다(날짜 띠는 다음 장 맨 위에 다시 나온다). 합계는 마지막 장.
const W = 360;
const PAD = 12;
export const SHARE_PAGE_H = 1500;
const HEAD_H = 40;
const FOOT_LAST_H = 46;
const FOOT_MORE_H = 26;
const BAND_H = 26;
const PARTY_H = 30; // 거래처 머리 띠 높이(카드형)
const ONE_GAP_H = 6; // 한 줄 표형에서 거래처 사이 간격
const GAP_H = 8; // 거래처 사이 간격
const TH_H = 22;
const ROW_H = 26;

type Ctx = CanvasRenderingContext2D;
type Block = { h: number; band: string | null; isEntry: boolean; draw: (ctx: Ctx, y: number) => void };

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const looksNumeric = (v: string) => /^[-+]?[\d,]+(\.\d+)?(\s?[A-Za-z가-힣]{1,4})?$/.test(v.trim());
const RIGHT_ROLES: ItemRole[] = ["qty", "price", "amount", "tax"];

function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
const font = (family: string, weight: number, size: number) => `${weight} ${size}px ${family}`;

const ROLE_LABEL: Record<ItemRole, string> = { name: "품명", spec: "규격", lot: "관리번호", qty: "수량", price: "단가", amount: "금액", tax: "세액", remark: "비고" };

export async function renderSharePages(model: ShareModel): Promise<Blob[]> {
  const entries = includedEntries(model);
  if (entries.length === 0) return [];
  const primary = css("--erp-primary", "#2563eb");
  const text = css("--erp-text", "#1b2a3a");
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const probe = document.createElement("canvas").getContext("2d")!;
  const roles = model.roles;

  // ── 한 줄 표형이 되는가: 품목 열이 4개 이하이고 이름 칸이 최소 폭을 지킬 때
  probe.font = font(family, 400, 13);
  const colW = new Map<ItemRole, number>();
  for (const r of roles) {
    if (r === "name") continue;
    const widest = Math.max(probe.measureText(ROLE_LABEL[r]).width, ...entries.flatMap((e) => e.items.map((i) => probe.measureText(i[r]).width)));
    colW.set(r, Math.ceil(widest) + 8);
  }
  probe.font = font(family, 400, 13);
  const partyW = Math.min(84, Math.ceil(Math.max(...entries.map((e) => probe.measureText(e.party).width), 40)) + 8);
  const fixedW = [...colW.values()].reduce((a, b) => a + b, 0);
  const nameW = W - PAD * 2 - partyW - fixedW;
  const oneLine = roles.length <= 4 && nameW >= 84;

  const blocks: Block[] = [];

  const drawBand = (label: string): Block => ({
    h: BAND_H,
    band: null,
    isEntry: false,
    draw: (ctx, y) => {
      ctx.fillStyle = "#dfe7f5";
      ctx.fillRect(0, y, W, BAND_H);
      ctx.fillStyle = "#1d3f8a";
      ctx.font = font(family, 700, 13);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, PAD, y + BAND_H / 2);
    },
  });
  const drawTableHead = (): Block => ({
    h: TH_H,
    band: null,
    isEntry: false,
    draw: (ctx, y) => {
      ctx.fillStyle = "#eef1f5";
      ctx.fillRect(0, y, W, TH_H);
      ctx.fillStyle = "#667085";
      ctx.font = font(family, 600, 12);
      ctx.textBaseline = "middle";
      let x = PAD;
      ctx.textAlign = "left";
      ctx.fillText("거래처", x, y + TH_H / 2);
      x += partyW;
      for (const r of roles) {
        const w = r === "name" ? nameW : colW.get(r)!;
        if (RIGHT_ROLES.includes(r)) {
          ctx.textAlign = "right";
          ctx.fillText(ROLE_LABEL[r], x + w - 4, y + TH_H / 2);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(ROLE_LABEL[r], x, y + TH_H / 2);
        }
        x += w;
      }
    },
  });

  // ── 전표(= 한 덩어리, 장이 나뉠 때 쪼개지지 않는다)
  const entryBlock = (e: ShareEntry): Block => {
    if (oneLine) {
      const h = e.items.length * ROW_H + ONE_GAP_H;
      return {
        h,
        band: e.date,
        isEntry: true,
        draw: (ctx, y) => {
          // 거래처 묶음 표시 — 왼쪽 굵은 막대 + 아래 회색 간격
          ctx.fillStyle = primary;
          ctx.fillRect(0, y + 2, 4, e.items.length * ROW_H - 4);
          e.items.forEach((it, n) => {
            const top = y + n * ROW_H;
            ctx.strokeStyle = "#eef0f3";
            ctx.beginPath();
            ctx.moveTo(PAD, top + ROW_H - 0.5);
            ctx.lineTo(W - PAD, top + ROW_H - 0.5);
            ctx.stroke();
            ctx.textBaseline = "middle";
            let x = PAD;
            if (n === 0) {
              ctx.textAlign = "left";
              ctx.fillStyle = text;
              ctx.font = font(family, 700, 13);
              ctx.fillText(fit(ctx, e.party, partyW - 6), x, top + ROW_H / 2);
            }
            x += partyW;
            for (const r of roles) {
              const w = r === "name" ? nameW : colW.get(r)!;
              ctx.fillStyle = r === "amount" ? text : "#334";
              ctx.font = font(family, r === "amount" || r === "name" ? 700 : 400, 13.5);
              if (RIGHT_ROLES.includes(r)) {
                ctx.textAlign = "right";
                ctx.fillText(it[r], x + w - 4, top + ROW_H / 2);
              } else {
                ctx.textAlign = "left";
                ctx.fillText(fit(ctx, it[r], w - 6), x, top + ROW_H / 2);
              }
              x += w;
            }
          });
          const gy = y + e.items.length * ROW_H;
          ctx.fillStyle = "#eceff4";
          ctx.fillRect(0, gy, W, ONE_GAP_H);
          ctx.strokeStyle = "#d5dbe5";
          ctx.beginPath();
          ctx.moveTo(0, gy + 0.5);
          ctx.lineTo(W, gy + 0.5);
          ctx.stroke();
        },
      };
    }
    // 두 줄형
    const innerW = W - PAD * 2;
    const has = (r: ItemRole) => roles.includes(r);
    const lineOf = (ctx: Ctx, it: ShareItem) => {
      const amountText = has("amount") ? it.amount : "";
      ctx.font = font(family, 700, 14);
      const amountW = amountText ? ctx.measureText(amountText).width + 10 : 0;
      const avail = innerW - 8 - amountW;
      ctx.font = font(family, 700, 14);
      const nameW1 = ctx.measureText(it.name).width;
      ctx.font = font(family, 400, 13);
      const specText = has("spec") ? it.spec : "";
      const lotText = has("lot") ? it.lot : "";
      const sub1 = [specText, lotText].filter(Boolean).join("  ");
      const fits = nameW1 + (sub1 ? 8 + ctx.measureText(sub1).width : 0) <= avail;
      const qtyPart = has("qty") ? it.qty : "";
      const pricePart = has("price") && it.price ? (qtyPart ? `× ${it.price}` : it.price) : "";
      const taxPart = has("tax") && it.tax ? `세액 ${it.tax}` : "";
      const left2 = [fits ? "" : sub1, qtyPart, pricePart, taxPart].filter(Boolean).join("  ");
      const remark = has("remark") ? it.remark : "";
      return { amountText, sub1: fits ? sub1 : "", left2, remark };
    };
    const lines = e.items.map((it) => lineOf(probe, it));
    const itemH = (l: (typeof lines)[number]) => 22 + (l.left2 || l.remark ? 18 : 0) + 6;
    const extraText = [e.docNo ? `전표 ${e.docNo}` : "", ...e.extras].filter(Boolean).join(" · ");
    const h = PARTY_H + lines.reduce((s, l) => s + itemH(l), 0) + 6 + GAP_H;
    return {
      h,
      band: e.date,
      isEntry: true,
      draw: (ctx, y) => {
        // 거래처 머리 띠 — 옅은 바탕 + 왼쪽 굵은 막대로 한눈에 다음 거래처임을 알린다.
        ctx.fillStyle = "#e9eef7";
        ctx.fillRect(0, y, W, PARTY_H);
        ctx.fillStyle = primary;
        ctx.fillRect(0, y, 5, PARTY_H);
        ctx.textBaseline = "middle";
        ctx.fillStyle = text;
        ctx.font = font(family, 700, 15);
        ctx.textAlign = "left";
        ctx.fillText(fit(ctx, e.party || "-", innerW * 0.55), PAD + 2, y + PARTY_H / 2);
        if (extraText) {
          ctx.fillStyle = "#667085";
          ctx.font = font(family, 400, 12);
          ctx.textAlign = "right";
          ctx.fillText(fit(ctx, extraText, innerW * 0.42), W - PAD, y + PARTY_H / 2);
        }
        let cy = y + PARTY_H + 4;
        e.items.forEach((it, n) => {
          const l = lines[n];
          if (n > 0) {
            ctx.strokeStyle = "#eef0f3";
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(PAD + 8, cy - 2.5);
            ctx.lineTo(W - PAD, cy - 2.5);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.textAlign = "left";
          ctx.fillStyle = text;
          ctx.font = font(family, 700, 14);
          const maxName = innerW - 8 - (l.amountText ? ctx.measureText(l.amountText).width + 14 : 0);
          const shownName = fit(ctx, it.name || "-", Math.max(60, maxName));
          ctx.fillText(shownName, PAD + 8, cy + 11);
          if (l.sub1) {
            const nx = PAD + 8 + ctx.measureText(shownName).width + 8;
            ctx.fillStyle = "#667085";
            ctx.font = font(family, 400, 13);
            ctx.fillText(fit(ctx, l.sub1, Math.max(20, W - PAD - nx - (l.amountText ? ctx.measureText(l.amountText).width + 14 : 0))), nx, cy + 11);
          }
          if (l.amountText) {
            ctx.textAlign = "right";
            ctx.fillStyle = text;
            ctx.font = font(family, 700, 14);
            ctx.fillText(l.amountText, W - PAD, cy + 11);
          }
          let next = cy + 22;
          if (l.left2 || l.remark) {
            ctx.textAlign = "left";
            ctx.fillStyle = "#556";
            ctx.font = font(family, 400, 12.5);
            const remarkW = l.remark ? ctx.measureText(l.remark).width + 16 : 0;
            ctx.fillText(fit(ctx, l.left2, innerW - 8 - remarkW - 6), PAD + 8, next + 8);
            if (l.remark) {
              const rw = Math.min(ctx.measureText(l.remark).width + 14, innerW * 0.4);
              ctx.fillStyle = "#fff2cc";
              ctx.beginPath();
              ctx.roundRect(W - PAD - rw, next, rw, 17, 6);
              ctx.fill();
              ctx.fillStyle = "#8a5a00";
              ctx.textAlign = "center";
              ctx.fillText(fit(ctx, l.remark, rw - 10), W - PAD - rw / 2, next + 8.5);
            }
            next += 18;
          }
          cy = next + 6;
        });
        // 거래처 사이 간격(회색 바탕) — 다음 거래처 띠와 확실히 갈라 보이게 한다.
        ctx.fillStyle = "#eceff4";
        ctx.fillRect(0, y + h - GAP_H, W, GAP_H);
        ctx.strokeStyle = "#d5dbe5";
        ctx.beginPath();
        ctx.moveTo(0, y + h - GAP_H + 0.5);
        ctx.lineTo(W, y + h - GAP_H + 0.5);
        ctx.stroke();
      },
    };
  };

  // ── 장 나누기
  const budget = SHARE_PAGE_H - HEAD_H - FOOT_LAST_H;
  type Page = { blocks: Block[]; h: number };
  const pages: Page[] = [];
  let cur: Page = { blocks: [], h: 0 };
  let lastBand: string | null = null;
  const startPage = () => {
    cur = { blocks: [], h: 0 };
    if (oneLine) {
      const th = drawTableHead();
      cur.blocks.push(th);
      cur.h += th.h;
    }
    lastBand = null;
  };
  startPage();
  for (const e of entries) {
    const eb = entryBlock(e);
    const needBand = eb.band !== lastBand;
    const need = eb.h + (needBand ? BAND_H : 0);
    if (cur.h + need > budget && cur.blocks.some((b) => b.isEntry)) {
      pages.push(cur);
      startPage();
    }
    if (eb.band !== lastBand) {
      const band = drawBand(dateBandLabel(eb.band ?? ""));
      cur.blocks.push(band);
      cur.h += band.h;
      lastBand = eb.band;
    }
    cur.blocks.push(eb);
    cur.h += eb.h;
  }
  pages.push(cur);

  const totals = shareTotals(model);
  const blobs: Blob[] = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const p = pages[pi];
    const isLast = pi === pages.length - 1;
    const foot = isLast ? FOOT_LAST_H + (totals.qtyLabel ? 18 : 0) : FOOT_MORE_H;
    const H = HEAD_H + p.h + foot;
    const canvas = document.createElement("canvas");
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, HEAD_H);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = font(family, 700, 15);
    ctx.fillText(fit(ctx, model.title, 170), PAD, HEAD_H / 2);
    ctx.textAlign = "right";
    ctx.font = font(family, 400, 12);
    ctx.fillText(`${model.today} 기준 · ${totals.count}건${pages.length > 1 ? ` · ${pi + 1}/${pages.length}장` : ""}`, W - PAD, HEAD_H / 2);
    let y = HEAD_H;
    for (const b of p.blocks) {
      b.draw(ctx, y);
      y += b.h;
    }
    ctx.fillStyle = "#f3f5f8";
    ctx.fillRect(0, y, W, foot);
    ctx.textBaseline = "middle";
    if (isLast) {
      ctx.fillStyle = text;
      ctx.textAlign = "left";
      ctx.font = font(family, 700, 15);
      ctx.fillText(`합계 (${totals.count}건)`, PAD, y + 23);
      if (totals.amount !== null) {
        ctx.textAlign = "right";
        ctx.fillText(`${totals.amount.toLocaleString("ko-KR")}원`, W - PAD, y + 23);
      }
      if (totals.qtyLabel) {
        ctx.fillStyle = "#556";
        ctx.font = font(family, 400, 12.5);
        ctx.textAlign = "right";
        ctx.fillText(`수량 ${totals.qtyLabel}`, W - PAD, y + 46);
      }
    } else {
      ctx.fillStyle = "#8590a0";
      ctx.textAlign = "right";
      ctx.font = font(family, 400, 12);
      ctx.fillText("다음 장에 이어집니다 ▸", W - PAD, y + foot / 2);
    }
    blobs.push(await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png")));
  }
  return blobs;
}
