"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/mail/crypto";
import { sendMail, type SendMailAttachment } from "@/lib/mail/smtp-send";
import { syncInbox } from "@/lib/mail/sync";
import type { FormState } from "@/components/form-message";

export async function syncMailAction(_prevState: FormState): Promise<FormState> {
  try {
    const result = await syncInbox();
    revalidatePath("/mail");
    return result.newCount > 0
      ? { success: `새 메일 ${result.newCount}통을 가져왔습니다.` }
      : { success: "새 메일이 없습니다." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function markMessageRead(id: string, isRead: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("mail_messages").update({ is_read: isRead }).eq("id", id);
  if (error) {
    console.error("메일 읽음 처리 실패:", error.message);
    return;
  }
  revalidatePath("/mail");
}

function splitAddresses(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function sendMailAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const to = splitAddresses(String(formData.get("to") ?? ""));
  const cc = splitAddresses(String(formData.get("cc") ?? ""));
  const bcc = splitAddresses(String(formData.get("bcc") ?? ""));
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyText = String(formData.get("body") ?? "");

  if (to.length === 0) return { error: "받는 사람을 입력해주세요." };
  if (!subject) return { error: "제목을 입력해주세요." };

  const supabase = await createClient();
  const { data: account, error: accountError } = await supabase
    .from("mail_accounts")
    .select("id, email_address, display_name, smtp_host, smtp_port, username, encrypted_app_password")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError || !account) {
    return { error: "연동된 메일 계정이 없습니다. 환경설정 > 메일 계정 연동에서 먼저 등록해주세요." };
  }

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  const attachments: SendMailAttachment[] = [];
  for (const file of files) {
    attachments.push({
      filename: file.name,
      content: await fileToBase64(file),
      mimeType: file.type || "application/octet-stream",
    });
  }

  try {
    const password = await decryptSecret(account.encrypted_app_password);
    await sendMail({
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      username: account.username,
      password,
      fromEmail: account.email_address,
      fromName: account.display_name,
      to,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      subject,
      text: bodyText,
    });
  } catch (err) {
    return { error: `발송에 실패했습니다: ${err instanceof Error ? err.message : String(err)}` };
  }

  // 발송 성공 후 "보낸편지함"에 로컬 기록을 남긴다 — 다음 서버의 실제
  // 보낸편지함을 다시 IMAP으로 읽어오지 않고, 우리가 방금 보낸 내용을
  // 그대로 기록한다(sync.ts 상단 주석 참고).
  const { data: maxUidRow } = await supabase
    .from("mail_messages")
    .select("uid")
    .eq("mail_account_id", account.id)
    .eq("folder", "SENT")
    .order("uid", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextUid = (maxUidRow?.uid ?? 0) + 1;

  const { data: sentRow, error: sentInsertError } = await supabase
    .from("mail_messages")
    .insert({
      mail_account_id: account.id,
      user_id: user.id,
      folder: "SENT",
      uid: nextUid,
      subject,
      from_address: account.email_address,
      from_name: account.display_name,
      to_addresses: to.map((email) => ({ name: null, email })),
      cc_addresses: cc.map((email) => ({ name: null, email })),
      sent_at: new Date().toISOString(),
      body_text: bodyText,
      snippet: bodyText.slice(0, 200),
      has_attachments: attachments.length > 0,
      is_read: true,
    })
    .select("id")
    .single();

  if (sentInsertError) {
    console.error("보낸편지함 로컬 기록 실패:", sentInsertError.message);
  }

  if (sentRow) {
    for (const file of files) {
      const path = `${user.id}/${sentRow.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("mail-attachments")
        .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (uploadError) continue;
      const { error: attachmentInsertError } = await supabase.from("mail_attachments").insert({
        mail_message_id: sentRow.id,
        user_id: user.id,
        filename: file.name,
        content_type: file.type || null,
        size_bytes: file.size,
        storage_path: path,
      });
      if (attachmentInsertError) {
        console.error("첨부파일 기록 실패:", attachmentInsertError.message);
      }
    }
  }

  revalidatePath("/mail");
  return { success: "메일을 보냈습니다." };
}
