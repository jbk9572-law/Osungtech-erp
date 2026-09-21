import PostalMime from "postal-mime";
import type { Email, Address } from "postal-mime";
import { createClient, getUser } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/mail/crypto";
import { ImapClient, type ImapRawMessage } from "@/lib/mail/imap-client";

const INBOX_FOLDER = "INBOX";
// 계정을 처음 연동했을 때 한 번에 가져올 최대 통수. 그 이후로는 마지막으로
// 본 UID 다음부터만 증분 동기화하므로 이 상한이 계속 적용되지 않는다.
const INITIAL_SYNC_LIMIT = 50;
// 한 번의 "동기화" 클릭당 처리할 최대 통수(밀린 메일이 아주 많아도 요청
// 하나가 너무 오래 걸리지 않도록). 더 있으면 버튼을 한 번 더 누르면 된다.
const MAX_PER_SYNC = 50;

function addressToText(addr: Address | undefined): { name: string | null; email: string | null } {
  if (!addr) return { name: null, email: null };
  if ("address" in addr && addr.address) {
    return { name: addr.name || null, email: addr.address };
  }
  return { name: addr.name || null, email: null };
}

function addressListToJson(list: Address[] | undefined): { name: string | null; email: string | null }[] {
  return (list ?? []).map((a) => addressToText(a));
}

function toUint8Array(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (typeof content === "string") return new TextEncoder().encode(content);
  return new Uint8Array(content);
}

export type SyncResult = { newCount: number };

// 받은편지함(INBOX)만 동기화한다 — 보낸 메일은 이 앱에서 발송할 때 바로
// mail_messages에 folder='SENT'로 직접 남기므로 다음 서버의 "보낸편지함"을
// 따로 IMAP으로 다시 읽어올 필요가 없다. 스팸함/휴지통 등 다른 폴더 동기화는
// 후속 작업으로 남겨둔다(폴더 목록 조회 자체는 imap-client.ts에 이미 있음).
export async function syncInbox(): Promise<SyncResult> {
  const user = await getUser();
  if (!user) throw new Error("인증되지 않은 요청입니다.");

  const supabase = await createClient();
  const { data: account, error: accountError } = await supabase
    .from("mail_accounts")
    .select("id, imap_host, imap_port, username, encrypted_app_password, last_synced_uid")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    throw new Error("연동된 메일 계정이 없습니다. 환경설정 > 메일 계정 연동에서 먼저 등록해주세요.");
  }

  let client: ImapClient | null = null;
  try {
    const password = await decryptSecret(account.encrypted_app_password);
    client = await ImapClient.connect(account.imap_host, account.imap_port);
    await client.login(account.username, password);
    const { exists } = await client.selectFolder(INBOX_FOLDER);

    const lastSyncedUidMap = (account.last_synced_uid ?? {}) as Record<string, number>;
    const lastUid = lastSyncedUidMap[INBOX_FOLDER] ?? 0;

    let raw: ImapRawMessage[];
    if (lastUid > 0) {
      raw = await client.uidFetchRaw(`${lastUid + 1}:*`);
    } else if (exists > 0) {
      const start = Math.max(1, exists - INITIAL_SYNC_LIMIT + 1);
      raw = await client.seqFetchRaw(`${start}:*`);
    } else {
      raw = [];
    }

    // 최신 통이 먼저 보이게, UID가 큰 것부터 최대 MAX_PER_SYNC개만 처리한다.
    raw.sort((a, b) => b.uid - a.uid);
    const toProcess = raw.slice(0, MAX_PER_SYNC);

    let maxUidSeen = lastUid;
    let inserted = 0;

    for (const msg of toProcess) {
      maxUidSeen = Math.max(maxUidSeen, msg.uid);
      let parsed: Email;
      try {
        parsed = await PostalMime.parse(msg.raw);
      } catch {
        continue; // 파싱 실패한 메일 한 통 때문에 전체 동기화가 멈추지 않게 건너뛴다.
      }

      const from = addressToText(parsed.from);
      const { data: inserted_row, error: insertError } = await supabase
        .from("mail_messages")
        .upsert(
          {
            mail_account_id: account.id,
            user_id: user.id,
            folder: INBOX_FOLDER,
            uid: msg.uid,
            message_id: parsed.messageId ?? null,
            subject: parsed.subject ?? null,
            from_address: from.email,
            from_name: from.name,
            to_addresses: addressListToJson(parsed.to),
            cc_addresses: addressListToJson(parsed.cc),
            sent_at: parsed.date ? new Date(parsed.date).toISOString() : null,
            body_text: parsed.text ?? null,
            body_html: parsed.html ?? null,
            snippet: (parsed.text ?? "").slice(0, 200),
            has_attachments: parsed.attachments.length > 0,
            size_bytes: msg.raw.byteLength,
          },
          { onConflict: "mail_account_id,folder,uid", ignoreDuplicates: true }
        )
        .select("id")
        .maybeSingle();

      if (insertError || !inserted_row) continue; // 이미 있던 메일(중복 동기화)이거나 실패 — 건너뛴다.
      inserted += 1;

      for (const att of parsed.attachments) {
        if (!att.filename) continue;
        const path = `${user.id}/${inserted_row.id}/${att.filename}`;
        const bytes = toUint8Array(att.content);
        const { error: uploadError } = await supabase.storage
          .from("mail-attachments")
          .upload(path, bytes, { upsert: true, contentType: att.mimeType });
        if (uploadError) continue;

        const { error: attachmentInsertError } = await supabase.from("mail_attachments").insert({
          mail_message_id: inserted_row.id,
          user_id: user.id,
          filename: att.filename,
          content_type: att.mimeType,
          size_bytes: bytes.byteLength,
          storage_path: path,
        });
        if (attachmentInsertError) {
          console.error("첨부파일 기록 실패:", attachmentInsertError.message);
        }
      }
    }

    const { error: updateError } = await supabase
      .from("mail_accounts")
      .update({
        last_synced_uid: { ...lastSyncedUidMap, [INBOX_FOLDER]: maxUidSeen },
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", account.id);
    if (updateError) {
      console.error("동기화 상태 갱신 실패:", updateError.message);
    }

    return { newCount: inserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { error: errorLogError } = await supabase
      .from("mail_accounts")
      .update({ last_sync_error: message, last_synced_at: new Date().toISOString() })
      .eq("id", account.id);
    if (errorLogError) {
      console.error("동기화 오류 기록 실패:", errorLogError.message);
    }
    throw err;
  } finally {
    if (client) await client.logout();
  }
}
