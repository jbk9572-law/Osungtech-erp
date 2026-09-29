"use server";

// syncInbox()가 IMAP 클라이언트(cloudflare:sockets 기반, imap-client.ts)를
// 불러오는데, 같은 파일을 서버 컴포넌트가 직접 import하면 next build의
// "Collect page data" 단계가 깨진다 — quotes/send-action.ts,
// hr/payroll/send-action.ts와 같은 이유. 이 액션을 쓰는
// notification-toaster.tsx(클라이언트 컴포넌트)만 직접 import해 서버
// 액션 참조로만 쓰고, 페이지 자체의 서버 모듈 그래프에는 안 들어가게
// 분리한다.
//
// 파일 분리만으로는 부족하다 — 배포된 Cloudflare Worker에서 이 액션이
// 실제로 호출되는 시점에 Next의 액션 디스패처가 require()로 이 파일을
// 불러오는데, cloudflare:sockets는 그 방식으로는 못 불러온다("Dynamic
// require of cloudflare:sockets is not supported" — official-documents
// 발송 액션에서 실제 발생 확인). api/cron/mail-sync/route.ts와 같은
// 이유로 syncInbox import를 함수 본문 안 동적 import로 미룬다.
import { getUser } from "@/lib/supabase/server";

// 탭이 열려 있는 동안 짧은 주기로 본인 메일함만 확인한다(notification-
// toaster.tsx, 45초) — 5분짜리 크론(api/cron/mail-sync)은 탭을 안 보고
// 있을 때의 안전망이고, 이건 "업무 보다가 메일 기다리기엔 5분은 너무
// 길다"는 문제를 실제로 해결하는 쪽이다. 메일 계정을 아직 연동 안 한
// 사용자, 또는 동기화 자체가 실패한 경우에도 에러를 올리지 않고 그냥
// newCount: 0으로 조용히 넘어간다 — 배경에서 계속 도는 확인이라 실패를
// 사용자에게 매번 보여줄 필요가 없다.
export async function pollMyMail(): Promise<{ newCount: number }> {
  const user = await getUser();
  if (!user) return { newCount: 0 };

  try {
    const { syncInbox } = await import("@/lib/mail/sync");
    return await syncInbox();
  } catch (err) {
    console.error("메일 자동 확인 실패:", err);
    return { newCount: 0 };
  }
}
