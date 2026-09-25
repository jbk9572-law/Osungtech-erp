"use server";

// sendQuote만 별도 파일로 뺐다 — 공문관리 send-action.ts와 같은 이유다.
// 이 함수가 쓰는 lib/mail/smtp-send.ts는 worker-mailer(cloudflare:sockets
// 기반)를 불러오는데, 이 모듈을 다른 액션들과 같은 파일(actions.ts)에
// 두면 서버 컴포넌트(quotes/[id]/page.tsx)가 그 파일을 직접 import할 때
// cloudflare:sockets까지 같은 서버 번들에 끌려 들어가 next build의
// "Collect page data" 단계에서 그 모듈을 못 찾아 빌드가 깨진다. 이 함수를
// 쓰는 발송 버튼(SendQuoteButton)만 클라이언트 컴포넌트에서 직접 import해
// 서버 액션 참조로만 쓰게 하고, 페이지 자체의 서버 모듈 그래프에는 안
// 들어가게 분리한다.
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/mail/crypto";
import { sendMail } from "@/lib/mail/smtp-send";
import type { FormState } from "@/components/form-message";

// 견적서를 실제로 이메일 발송한다. 지금까지 "발송" 버튼은 quotes.status만
// 'sent'로 바꿨을 뿐 아무 이메일도 나가지 않았다(사용자 지적) — 공문관리
// 모듈이 쓰는 mail_accounts(설정 > 메일 계정 연동) + sendMail 패턴을 그대로
// 가져와서, 실제로 발송에 성공했을 때만 상태를 바꾼다.
export async function sendQuote(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, doc_no, quote_date, valid_until, memo, customers(name, email)")
    .eq("id", id)
    .maybeSingle();
  if (!quote) return { error: "견적서를 찾을 수 없습니다." };

  const customerEmail = quote.customers?.email;
  if (!customerEmail) {
    return { error: "거래처에 등록된 이메일이 없습니다. 거래처 정보에서 이메일을 먼저 등록해주세요." };
  }

  const { data: account } = await supabase
    .from("mail_accounts")
    .select("email_address, display_name, smtp_host, smtp_port, username, encrypted_app_password")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) {
    return { error: "연동된 메일 계정이 없습니다. 설정 > 메일 계정 연동에서 먼저 연결해주세요." };
  }

  const { data: items } = await supabase
    .from("quote_items")
    .select("spec, quantity, unit_price, remark, products(name)")
    .eq("quote_id", id);

  const total = (items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
  const itemLines = (items ?? [])
    .map((i) => {
      const name = i.products?.name ?? "-";
      const amount = Number(i.quantity) * Number(i.unit_price);
      return `- ${name}${i.spec ? ` (${i.spec})` : ""} : ${Number(i.quantity).toLocaleString()} x ${Number(i.unit_price).toLocaleString()} = ${amount.toLocaleString()}원`;
    })
    .join("\n");

  const subject = `[견적서 #${quote.doc_no}] ${quote.customers?.name ?? ""}`;
  const text = [
    `${quote.customers?.name ?? "고객"}님께,`,
    "",
    `견적서 #${quote.doc_no} (${quote.quote_date})를 보내드립니다.`,
    quote.valid_until ? `유효기간: ~${quote.valid_until}` : "",
    "",
    itemLines,
    "",
    `합계: ${total.toLocaleString()}원`,
    quote.memo ? `\n메모: ${quote.memo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const password = await decryptSecret(account.encrypted_app_password);
    await sendMail({
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      username: account.username,
      password,
      fromEmail: account.email_address,
      fromName: account.display_name,
      to: [customerEmail],
      subject,
      text,
    });
  } catch (err) {
    return { error: `이메일 발송에 실패했습니다: ${err instanceof Error ? err.message : String(err)}` };
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) console.error("견적서 발송 후 상태 갱신 실패:", updateError.message);

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { success: `${customerEmail} 앞으로 견적서를 이메일 발송했습니다.` };
}
