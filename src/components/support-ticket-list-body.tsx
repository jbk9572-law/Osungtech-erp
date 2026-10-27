"use client";

import { useMemo, useState } from "react";
import { RichTextView } from "@/components/erp/rich-text-view";
import { GridBadge } from "@/components/grid/badge";
import { SplitDetailEmpty } from "@/components/erp/page-header";
import { ChatIcon } from "@/components/erp/groupware-icons";
import { SupportTicketReplyForm } from "@/components/support-ticket-reply-form";
import { replySupportTicket } from "@/app/platform-admin/support/actions";
import { resolveStatusLabel } from "@/lib/status-label";

export type SupportTicketRow = {
  id: string;
  doc_no: number;
  subject: string;
  message: string;
  status: string;
  reply: string | null;
  created_at: string;
  tenantName: string;
};

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  open: { label: "답변 대기", tone: "warn" },
  answered: { label: "답변 완료", tone: "ok" },
  closed: { label: "종료", tone: "muted" },
};

// 회사 구분 없이 전체 문의가 한 줄로 쭉 나오던 걸(답변 폼까지 전부 펼친
// 채로) 다른 그룹웨어 분할뷰(공지사항의 .erp-split3-shell — 카테고리
// 사이드바+목록+상세)와 같은 모양으로 맞춘다. 문의 데이터(메시지 본문
// 포함) 전체를 페이지가 이미 한 번에 받아와서, 상세는 서버에 다시
// 요청하지 않고 같은 배열에서 고른다 — 그래서 고객사 분할뷰처럼
// ?id= URL 쿼리로 선택 상태를 들고 다닐 필요 없이 클라이언트 state로
// 충분하다(새로고침해도 어차피 "전체" 탭 + 선택 없음으로 돌아가는 게
// 이 화면에서는 자연스럽다 — 문의함을 북마크해 둘 일은 없다).
export function SupportTicketListBody({ tickets }: { tickets: SupportTicketRow[] }) {
  const [tenant, setTenant] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tenantCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tickets) counts.set(t.tenantName, (counts.get(t.tenantName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  const visibleTickets = tenant === "all" ? tickets : tickets.filter((t) => t.tenantName === tenant);
  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
      <div className="erp-cat-sidebar">
        <button
          type="button"
          onClick={() => {
            setTenant("all");
            setSelectedId(null);
          }}
          className={`erp-cat-item${tenant === "all" ? " active" : ""}`}
        >
          <span>전체</span>
          <span className="cnt">{tickets.length}</span>
        </button>
        {tenantCounts.map(([name, count]) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setTenant(name);
              setSelectedId(null);
            }}
            className={`erp-cat-item${tenant === name ? " active" : ""}`}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span className="cnt">{count}</span>
          </button>
        ))}
      </div>

      <section className="erp-split-list">
        <div className="erp-split-list-head">
          <span>문의 목록</span>
          <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>{visibleTickets.length}건</span>
        </div>
        <div className="erp-split-list-body">
          {visibleTickets.map((t) => {
            const status = resolveStatusLabel(STATUS_LABEL, t.status);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`erp-split-list-row${t.id === selectedId ? " active" : ""}`}
                style={{ width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer" }}
              >
                <span style={{ fontWeight: 700 }}>
                  #{t.doc_no} {t.subject}
                </span>
                <span style={{ marginLeft: 6 }}>
                  <GridBadge tone={status.tone}>{status.label}</GridBadge>
                </span>
                <div className="erp-split-list-row-sub" style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span>{t.tenantName}</span>
                  <span>{new Date(t.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
              </button>
            );
          })}
          {!visibleTickets.length && (
            <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              등록된 문의가 없습니다.
            </p>
          )}
        </div>
      </section>

      <div className="erp-split-detail">
        {selected ? (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 erp-h1" style={{ fontSize: "var(--erp-font-lg)" }}>
                #{selected.doc_no} {selected.subject}
              </h2>
              <GridBadge tone={resolveStatusLabel(STATUS_LABEL, selected.status).tone}>
                {resolveStatusLabel(STATUS_LABEL, selected.status).label}
              </GridBadge>
            </div>
            <p className="mb-4 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              {selected.tenantName} · {new Date(selected.created_at).toLocaleString("ko-KR")}
            </p>
            <RichTextView
              html={selected.message}
              className="erp-richtext-content mb-4 text-xs"
              style={{ padding: 0, color: "var(--erp-text-muted)" }}
            />
            <SupportTicketReplyForm ticketId={selected.id} defaultReply={selected.reply} action={replySupportTicket} />
          </div>
        ) : (
          <SplitDetailEmpty
            icon={<ChatIcon />}
            title="문의를 선택해주세요"
            hint="왼쪽에서 회사를 고르고, 가운데 목록에서 문의를 누르면 여기에 내용과 답변 작성칸이 표시됩니다."
          />
        )}
      </div>
    </div>
  );
}
