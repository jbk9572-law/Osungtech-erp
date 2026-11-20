import Link from "next/link";
import type { ReactNode } from "react";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";

// 목록 오른쪽 상세 패널의 공용 껍데기 — 매출/매입(OrderSidePanel)과 같은 .erp-detail-side* 모양을 쓰고, 재고·미수금·미지급금이 같이 쓴다.
// 내용(머리·키값·합계·구역·바로가기·버튼)만 화면이 넘기고, 모양과 빈 상태·불러오는 중 표시는 여기서 한 번만 정한다.
export type SideRow = { left: ReactNode; mid?: ReactNode; right?: ReactNode; tone?: "danger" | "warn" };
export type SideSection = { heading: string; rows: SideRow[]; emptyText?: string; moreText?: string };
export type SideTotal = { label: string; value: ReactNode; tone?: "danger" | "success"; strong?: boolean };
export type SideLink = { label: string; hint?: string; href: string };
export type SideAction = { label: string; href: string };
export type SideContent = {
  title: string;
  subtitle?: string;
  badge?: { tone: "ok" | "warn" | "danger"; label: string };
  /** 제목 아래 추가 색 칩(분류·결제조건 등). badge는 항상 맨 앞 칩. */
  chips?: { tone: BadgeTone; label: string }[];
  kv?: { label: string; value: ReactNode }[];
  totals?: SideTotal[];
  sections?: SideSection[];
  links?: SideLink[];
  actions?: SideAction[];
};

export function DetailSideShell({
  ariaLabel,
  emptyText,
  content,
  loading,
}: {
  ariaLabel: string;
  emptyText: string;
  /** null이면 아직 고른 행이 없다. */
  content: SideContent | null;
  /** 고른 행의 나머지 정보(서버 조회)를 불러오는 중 — content의 제목·키값은 이미 보이고 구역만 "불러오는 중"으로 둔다. */
  loading?: boolean;
}) {
  return (
    // 윗줄 강조색 — 상태 뱃지의 색(정상=초록, 주의=노랑, 위험=빨강)을 따른다. 뱃지가 없으면 기본(파랑).
    <aside
      className="erp-detail-side"
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      data-tone={content?.badge ? { ok: "success", warn: "warn", danger: "danger" }[content.badge.tone] : undefined}
    >
      {!content ? (
        <p className="erp-detail-side-empty">{emptyText}</p>
      ) : (
        <>
          <div className="erp-detail-side-hero">
            {(content.badge || (content.chips && content.chips.length > 0)) && (
              <div className="erp-detail-side-chips">
                {content.badge && <GridBadge tone={content.badge.tone}>{content.badge.label}</GridBadge>}
                {content.chips?.map((c) => (
                  <GridBadge key={c.label} tone={c.tone}>
                    {c.label}
                  </GridBadge>
                ))}
              </div>
            )}
            <b className="erp-detail-side-title">{content.title}</b>
            {content.subtitle && <span className="erp-detail-side-date">{content.subtitle}</span>}
          </div>
          {content.kv && content.kv.length > 0 && (
            <dl className="erp-detail-side-kv">
              {content.kv.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {content.totals && content.totals.length > 0 && (
            <div className="erp-detail-side-total">
              {content.totals.map((t) => (
                <div key={t.label} className={t.strong ? "erp-detail-side-total-sum" : undefined}>
                  <span>{t.label}</span>
                  <span className={t.tone ? `erp-detail-side-${t.tone}` : undefined}>{t.value}</span>
                </div>
              ))}
            </div>
          )}
          {content.sections?.map((s) => (
            <div key={s.heading} className="erp-detail-side-sec">
              <h4>{s.heading}</h4>
              {loading ? (
                <p className="erp-detail-side-note">불러오는 중…</p>
              ) : s.rows.length === 0 ? (
                <p className="erp-detail-side-note">{s.emptyText ?? "내역이 없습니다."}</p>
              ) : (
                <>
                  {s.rows.map((r, i) => (
                    <div key={i} className={`erp-detail-side-row${r.tone ? ` is-${r.tone}` : ""}`}>
                      <span>{r.left}</span>
                      <span className="erp-detail-side-mid">{r.mid}</span>
                      <b>{r.right}</b>
                    </div>
                  ))}
                  {s.moreText && <p className="erp-detail-side-note">{s.moreText}</p>}
                </>
              )}
            </div>
          ))}
          {content.links && content.links.length > 0 && (
            <div className="erp-detail-side-sec">
              <h4>바로가기</h4>
              {content.links.map((l) => (
                <Link key={l.label} href={l.href} className="erp-detail-side-link">
                  <span>{l.label}</span>
                  {l.hint ? <em>{l.hint}</em> : null}
                  <i>열기 ›</i>
                </Link>
              ))}
            </div>
          )}
          {content.actions && content.actions.length > 0 && (
            <div className="erp-detail-side-actions">
              {content.actions.map((a, i) => (
                <Link key={a.label} href={a.href} className={i === 0 ? "erp-btn erp-btn-primary" : "erp-btn"}>
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
