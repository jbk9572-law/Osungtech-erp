"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/mail/crypto";
import { ImapClient } from "@/lib/mail/imap-client";
import type { FormState } from "@/components/form-message";

type MailAccountInput = {
  emailAddress: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  appPassword: string;
};

function parseInput(formData: FormData): MailAccountInput {
  return {
    emailAddress: String(formData.get("email_address") ?? "").trim(),
    displayName: String(formData.get("display_name") ?? "").trim(),
    imapHost: String(formData.get("imap_host") ?? "imap.daum.net").trim(),
    imapPort: Number(formData.get("imap_port") ?? 993) || 993,
    smtpHost: String(formData.get("smtp_host") ?? "smtp.daum.net").trim(),
    smtpPort: Number(formData.get("smtp_port") ?? 465) || 465,
    username: String(formData.get("username") ?? "").trim(),
    appPassword: String(formData.get("app_password") ?? ""),
  };
}

// 저장 전에 실제 로그인이 되는지 먼저 확인해본다 — 앱 비밀번호를 잘못
// 입력한 채로 저장해두면 나중에 동기화 버튼을 눌렀을 때에야 실패를
// 알게 되므로, 등록 화면에서 바로 검증할 수 있게 한다.
export async function testMailConnection(_prevState: FormState, formData: FormData): Promise<FormState> {
  const input = parseInput(formData);
  if (!input.username || !input.appPassword) {
    return { error: "아이디와 앱 비밀번호를 입력해주세요." };
  }

  let client: ImapClient | null = null;
  try {
    client = await ImapClient.connect(input.imapHost, input.imapPort);
    await client.login(input.username, input.appPassword);
    return { success: "연결에 성공했습니다. 아래 저장 버튼을 눌러 계정을 등록해주세요." };
  } catch (err) {
    return { error: `연결에 실패했습니다: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    if (client) await client.logout();
  }
}

export async function saveMailAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const input = parseInput(formData);
  if (!input.emailAddress || !input.username) {
    return { error: "이메일 주소와 아이디를 입력해주세요." };
  }

  const supabase = await createClient();

  // 비밀번호 입력칸을 비워두고 저장하면(이미 등록된 계정을 다른 값만
  // 고칠 때) 기존 암호문을 그대로 유지한다 — 매번 비밀번호를 다시
  // 입력하게 하면 "다른 정보만 고치려 했는데 비밀번호를 몰라 못
  // 바꾼다"는 불편이 생긴다.
  let encryptedAppPassword: string | undefined;
  if (input.appPassword) {
    encryptedAppPassword = await encryptSecret(input.appPassword);
  } else {
    const { data: existing } = await supabase
      .from("mail_accounts")
      .select("encrypted_app_password")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      return { error: "앱 비밀번호를 입력해주세요." };
    }
    encryptedAppPassword = existing.encrypted_app_password;
  }

  const { error } = await supabase.from("mail_accounts").upsert(
    {
      user_id: user.id,
      email_address: input.emailAddress,
      display_name: input.displayName || null,
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      username: input.username,
      encrypted_app_password: encryptedAppPassword,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/settings/mail");
  revalidatePath("/mail", "layout");
  return { success: "메일 계정이 저장되었습니다." };
}

export async function deleteMailAccount(_prevState: FormState): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("mail_accounts").delete().eq("user_id", user.id);
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/mail");
  revalidatePath("/mail", "layout");
  return { success: "메일 계정 연동을 해제했습니다." };
}
