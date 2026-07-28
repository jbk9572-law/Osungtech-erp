"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 대시보드는 서버 컴포넌트가 요청 시점에 계산한 "오늘" 기준 데이터(오늘의
// 업무, 마감 임박 할일 등)를 내려준다. 브라우저 탭을 자정 넘어서까지 계속
// 열어두면, 실제 날짜는 바뀌었는데도 화면은 새로고침 전까지 어제 날짜
// 기준으로 그대로 남아있는다. 다음 자정까지 남은 시간을 재서 그 시점에
// router.refresh()로 서버 컴포넌트를 다시 렌더링시켜 자동으로 갱신되게
// 한다(라우팅 없이 현재 화면 그대로 데이터만 새로 받아온다).
export function MidnightRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const now = new Date();
      // 클라이언트/서버 시계가 약간 어긋나 자정 직후 요청이 "어제"로 계산되는
      // 걸 막기 위해 5초 여유를 둔다.
      const nextRefresh = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      const ms = nextRefresh.getTime() - now.getTime();
      timer = setTimeout(() => {
        router.refresh();
        scheduleNext();
      }, ms);
    }

    scheduleNext();
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
