// 계정 권한 라벨/순서를 한 곳에서 관리한다 — 생성/수정/목록 화면이 각자
// 따로 옵션을 나열하다 보니 순서가 서로 어긋나 있었다(어떤 화면은
// 일반→매니저→관리자, 어떤 화면은 관리자→매니저→일반).
export const ROLE_LABELS: Record<string, string> = {
  staff: "일반",
  manager: "매니저",
  admin: "관리자",
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [string, string][];
