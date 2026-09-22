// 두 좌표 사이의 지표면 거리(미터) — 하버사인 공식. 근태 GPS 체크에서
// "사무실에서 몇 m 떨어져 있었는지"를 계산하는 용도로만 쓰므로, 이 정도
// 근사(지구를 완전한 구로 가정)면 충분하다.
const EARTH_RADIUS_M = 6371000;

export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}
