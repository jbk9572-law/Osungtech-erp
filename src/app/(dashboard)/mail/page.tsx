import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { SyncMailButton } from "@/components/mail/sync-mail-button";
import { ComposeMailButton } from "@/components/mail/compose-mail";
import { MarkAsRead } from "@/components/mail/mark-as-read";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

type Folder = "INBOX" | "SENT";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; id?: string }>;
}) {
  const { folder: folderParam, id } = await searchParams;
  const folder: Folder = folderParam === "SENT" ? "SENT" : "INBOX";

  const user = await getUser();
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "mail");

  const { data: account } = user
    ? await supabase.from("mail_accounts").select("id, email_address").eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!account) {
    return (
      <div>
        <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
        <ListPageHeader title="메일함" />
        <PageGuide>
          아직 연동된 메일 계정이 없습니다. 환경설정 &gt; 메일 계정 연동에서 다음
          스마트워크 계정을 먼저 등록해주세요.
        </PageGuide>
        <Link href="/settings/mail" className="erp-btn erp-btn-primary">
          메일 계정 연동하러 가기
        </Link>
      </div>
    );
  }

  const { data: messages } = await supabase
    .from("mail_messages")
    .select("id, subject, from_address, from_name, to_addresses, sent_at, snippet, is_read, has_attachments")
    .eq("mail_account_id", account.id)
    .eq("folder", folder)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const selected = id
    ? (
        await supabase
          .from("mail_messages")
          .select(
            "id, subject, from_address, from_name, to_addresses, cc_addresses, sent_at, body_text, body_html, has_attachments, is_read"
          )
          .eq("id", id)
          .eq("mail_account_id", account.id)
          .maybeSingle()
      ).data
    : null;

  const attachments = selected
    ? (
        await supabase
          .from("mail_attachments")
          .select("id, filename, content_type, size_bytes, storage_path")
          .eq("mail_message_id", selected.id)
      ).data ?? []
    : [];

  const attachmentLinks = await Promise.all(
    attachments.map(async (att) => {
      const { data } = await supabase.storage.from("mail-attachments").createSignedUrl(att.storage_path, 600);
      return { ...att, url: data?.signedUrl ?? null };
    })
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader
        title="메일함"
        actions={
          <>
            <ComposeMailButton />
            <SyncMailButton />
          </>
        }
      />

      <div className="erp-toolbar" style={{ marginTop: -4 }}>
        <Link
          href="/mail?folder=INBOX"
          className={`erp-btn${folder === "INBOX" ? " erp-btn-primary" : ""}`}
        >
          받은편지함
        </Link>
        <Link
          href="/mail?folder=SENT"
          className={`erp-btn${folder === "SENT" ? " erp-btn-primary" : ""}`}
        >
          보낸편지함
        </Link>
      </div>

      <div className={`erp-mail-layout${id ? " has-selection" : ""}`}>
        <div className="erp-mail-list">
          {(messages ?? []).length === 0 && (
            <div className="erp-mail-detail-empty">메일이 없습니다.</div>
          )}
          {(messages ?? []).map((m) => (
            <Link
              key={m.id}
              href={`/mail?folder=${folder}&id=${m.id}`}
              className={`erp-mail-row${!m.is_read ? " unread" : ""}${m.id === id ? " active" : ""}`}
            >
              <div className="erp-mail-row-top">
                <span>{folder === "INBOX" ? m.from_name || m.from_address || "(발신자 없음)" : "나"}</span>
                <span>{formatDate(m.sent_at)}</span>
              </div>
              <span className="erp-mail-row-subject">
                {m.subject || "(제목 없음)"} {m.has_attachments ? "📎" : ""}
              </span>
              <span className="erp-mail-row-snippet">{m.snippet}</span>
            </Link>
          ))}
        </div>

        <div className="erp-mail-detail">
          <Link href={`/mail?folder=${folder}`} className="erp-mail-back-link erp-btn">
            ← 목록으로
          </Link>
          {!selected ? (
            <div className="erp-mail-detail-empty">메일을 선택해주세요.</div>
          ) : (
            <>
              <MarkAsRead messageId={selected.id} isRead={selected.is_read} />
              <h2 className="mb-2 text-base font-bold text-[var(--erp-text)]">
                {selected.subject || "(제목 없음)"}
              </h2>
              <div className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                <p>
                  보낸사람: {selected.from_name || selected.from_address || "-"}
                  {selected.from_name && selected.from_address ? ` <${selected.from_address}>` : ""}
                </p>
                <p>
                  받는사람:{" "}
                  {((selected.to_addresses as { name: string | null; email: string | null }[]) ?? [])
                    .map((a) => a.email)
                    .filter(Boolean)
                    .join(", ") || "-"}
                </p>
                <p>{formatDate(selected.sent_at)}</p>
              </div>

              {attachmentLinks.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachmentLinks.map((att) =>
                    att.url ? (
                      <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="erp-btn">
                        📎 {att.filename}
                      </a>
                    ) : (
                      <span key={att.id} className="erp-btn" style={{ opacity: 0.5 }}>
                        📎 {att.filename}
                      </span>
                    )
                  )}
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--erp-divider)", paddingTop: 12 }}>
                {selected.body_html ? (
                  // 외부에서 온 메일 원문 HTML은 절대 신뢰할 수 없다(악성 스크립트가
                  // 섞여 들어올 수 있음) — dangerouslySetInnerHTML로 이 앱 페이지에
                  // 직접 꽂으면 우리 세션 쿠키/스토리지에 접근 가능한 XSS가 된다.
                  // 스크립트 실행이 막힌 sandbox iframe(다른 오리진처럼 격리됨) 안에
                  // 그려서, 내용은 그대로 보여주되 실행 권한은 주지 않는다.
                  <iframe
                    title="메일 본문"
                    srcDoc={selected.body_html}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    style={{ width: "100%", minHeight: 420, border: "none" }}
                  />
                ) : (
                  <p style={{ whiteSpace: "pre-wrap" }}>{selected.body_text || "(내용 없음)"}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
