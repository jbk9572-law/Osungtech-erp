"use server";

// sendPayslip만 별도 파일로 뺐다 — quotes/send-action.ts와 같은 이유다.
// 이 함수가 쓰는 lib/mail/smtp-send.ts는 worker-mailer(cloudflare:sockets
// 기반)를 불러오는데, 같은 파일(hr/actions.ts)에 두면 그 파일을 직접
// import하는 서버 컴포넌트(hr/payroll/page.tsx 등)의 서버 번들에
// cloudflare:sockets까지 끌려 들어가 next build의 "Collect page data"
// 단계가 깨진다. 이 함수를 쓰는 발송 버튼(SendPayslipButton)만 클라이언트
// 컴포넌트에서 직접 import해 서버 액션 참조로만 쓰고, 페이지 자체의 서버
// 모듈 그래프에는 안 들어가게 분리한다.
import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { decryptSecret } from "@/lib/mail/crypto";
import { sendMail } from "@/lib/mail/smtp-send";
import type { FormState } from "@/components/form-message";
import { formatNumber } from "@/lib/format-number";

// 급여명세를 본인(직원) 이메일로 발송한다. 거래처가 아니라 급여명세의
// 당사자에게 보내는 문서라 quotes와 달리 수신자는 profiles.email이고,
// 관리자만 보낼 수 있다(RLS는 select만 본인 허용이라 발송 자체의 권한은
// 여기서 직접 확인해야 한다).
export async function sendPayslip(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const { isAdmin } = await getCurrentActor(supabase);
  if (!isAdmin) return { error: "관리자만 발송할 수 있습니다." };

  const { data: payslip } = await supabase
    .from("payslips")
    .select(
      "pay_month, status, base_pay, bonus_performance, bonus_special, gross_pay, pension_deduction, health_deduction, long_term_care_deduction, employment_deduction, total_deduction, net_pay, annual_leave_total, annual_leave_used, profiles!user_id(full_name, email, position_title, departments(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!payslip) return { error: "급여명세를 찾을 수 없습니다." };

  const employeeEmail = payslip.profiles?.email;
  if (!employeeEmail) {
    return { error: "해당 구성원의 이메일이 등록되어 있지 않습니다." };
  }

  const { data: account } = await supabase
    .from("mail_accounts")
    .select("email_address, display_name, smtp_host, smtp_port, username, encrypted_app_password")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) {
    return { error: "연동된 메일 계정이 없습니다. 설정 > 메일 계정 연동에서 먼저 연결해주세요." };
  }

  const [year, month] = payslip.pay_month.split("-");
  const annualLeaveLine =
    payslip.annual_leave_total !== null && payslip.annual_leave_used !== null
      ? `연차: 총 ${payslip.annual_leave_total}일 · 사용 ${payslip.annual_leave_used}일 · 잔여 ${Number(payslip.annual_leave_total) - Number(payslip.annual_leave_used)}일`
      : "";

  const subject = `[급여명세서] ${year}년 ${Number(month)}월분`;
  const orgLine = [payslip.profiles?.departments?.name, payslip.profiles?.position_title].filter(Boolean).join(" · ");

  const text = [
    `${payslip.profiles?.full_name ?? "구성원"}님께,`,
    "",
    `${year}년 ${Number(month)}월분 급여명세서를 보내드립니다.`,
    orgLine ? `소속: ${orgLine}` : "",
    "",
    `기본급: ${formatNumber(Number(payslip.base_pay))}원`,
    Number(payslip.bonus_performance) > 0 ? `성과금: ${formatNumber(Number(payslip.bonus_performance))}원` : "",
    Number(payslip.bonus_special) > 0 ? `특별상여금: ${formatNumber(Number(payslip.bonus_special))}원` : "",
    `지급액 합계: ${formatNumber(Number(payslip.gross_pay))}원`,
    `공제액 합계: -${formatNumber(Number(payslip.total_deduction))}원 (국민연금/건강보험/장기요양보험/고용보험)`,
    `실지급액: ${formatNumber(Number(payslip.net_pay))}원`,
    "",
    annualLeaveLine,
    "",
    "※ 소득세/지방소득세 원천징수는 이 명세서에 반영되지 않았습니다.",
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
      to: [employeeEmail],
      subject,
      text,
    });
  } catch (err) {
    return { error: `이메일 발송에 실패했습니다: ${err instanceof Error ? err.message : String(err)}` };
  }

  return { success: `${employeeEmail} 앞으로 급여명세서를 이메일 발송했습니다.` };
}
