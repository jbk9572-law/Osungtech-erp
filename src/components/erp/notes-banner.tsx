"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { lookupPartyProductValue } from "@/lib/party-price-lookup";

export type NoteItem = { name: string; note: string };

/** 고른 품목 중 이 거래처와 짝지어 메모가 있는 것만 모은다(같은 품목은 한 번만) — 매출·매입 전표 공용. */
export function usePartyProductNotes(
  rows: { productId: string }[],
  noteMap: Parameters<typeof lookupPartyProductValue<string | null>>[0],
  partyId: string,
  products: { id: string; name: string }[],
): NoteItem[] {
  return useMemo(() => {
    const out: NoteItem[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.productId || seen.has(row.productId)) continue;
      const note = lookupPartyProductValue(noteMap, partyId, row.productId);
      if (!note) continue;
      seen.add(row.productId);
      out.push({ name: products.find((p) => p.id === row.productId)?.name ?? "품목", note });
    }
    return out;
  }, [rows, noteMap, partyId, products]);
}

// 전표(매출·매입)의 "특이사항" 배너 — 거래처 특이사항 + 품목별 특이사항을 한 곳에 모아 파란 띠 하나로 보여준다.
// 접힌 상태는 2줄까지, 넘치거나 품목 메모가 있으면 [더 보기]로 그 자리에서 펼친다(팝업 없음).
// 품목 줄에는 표 안에 글자를 끼우지 않고 작은 점(NoteDot)만 둔다 — 줄 높이가 메모 유무로 흔들리지 않게(개발헌법 3번, 매출·매입 공용).
export function NotesBanner({ partyLabel, partyNote, items }: { partyLabel: string; partyNote?: string | null; items: NoteItem[] }) {
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const party = partyNote?.trim() || "";

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 접힌 상태에서 글이 2줄을 넘는지 그린 뒤 한 번 잰다
    setOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [party, items, open]);

  if (!party && items.length === 0) return null;
  const canToggle = open || overflow;
  return (
    <div className="erp-notes-banner" role="note">
      <b className="erp-notes-label">특이사항</b>
      <div ref={bodyRef} className={`erp-notes-body${open ? "" : " is-clamped"}`}>
        {party && (
          <div>
            {partyLabel && <b>{partyLabel} </b>}
            {party}
          </div>
        )}
        {items.length > 0 && !open && (
          <div>
            <b>품목 {items.length}건</b> {items[0].name} — {items[0].note}
            {items.length > 1 ? ` 외 ${items.length - 1}건` : ""}
          </div>
        )}
        {items.length > 0 && open && (
          <>
            <div className="erp-notes-sec">
              <b>품목별</b>
            </div>
            <ul>
              {items.map((it) => (
                <li key={it.name}>
                  <b>{it.name}</b> — {it.note}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {(canToggle || items.length > 1) && (
        <button type="button" className="erp-btn erp-btn-sm erp-notes-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "접기 ▴" : "더 보기 ▾"}
        </button>
      )}
    </div>
  );
}

/** 품목 줄의 메모 표시점 — 메모가 있는 줄만. 올리면 메모 전문이 말풍선으로 보인다. */
export function NoteDot({ note }: { note?: string | null }) {
  if (!note) return null;
  return <span className="erp-note-dot" title={`품목 특이사항: ${note}`} aria-label={`품목 특이사항: ${note}`} />;
}
