// 매출/매입/할일/공지사항처럼 "작성자 본인 또는 관리자만 수정·삭제 가능"
// 규칙을 쓰는 화면들이 공유하는 판정 함수. DB(RLS)가 실제 방어선이고, 이
// 함수는 그 규칙과 어긋나지 않는 선에서 화면에 수정/삭제 버튼을 보여줄지
// 결정하는 용도다 — 여기서 통과해도 DB가 최종적으로 막을 수 있고, 반대로
// 이 판정 기준이 바뀌면 여기 하나만 고치면 그걸 쓰는 모든 화면이 같이
// 바뀐다.
export function canManage(ownerId: string | null, currentUserId: string | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (!currentUserId || !ownerId) return false;
  return ownerId === currentUserId;
}
