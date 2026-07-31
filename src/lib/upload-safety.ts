// 업로드 파일의 저장 Content-Type을 정할 때 쓰는 공통 안전장치.
// 클라이언트가 보낸 file.type을 그대로 스토리지에 저장하면, 브라우저가
// 그 타입을 그대로 믿고 렌더링하는 종류(HTML/SVG/JS)는 첨부파일 URL을
// 직접 열었을 때 업로드한 스크립트가 그대로 실행될 수 있다(저장된 XSS).
// 이런 타입만 안전한 범용 타입으로 강제로 바꿔서 다운로드되게 하고,
// 문서/이미지/압축파일 등 실제로 미리보기가 필요한 정상적인 타입은
// 그대로 둔다.
const DANGEROUS_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
]);

export function sanitizeUploadContentType(declaredType: string | undefined | null): string {
  const type = (declaredType || "").toLowerCase().trim();
  if (!type || DANGEROUS_CONTENT_TYPES.has(type)) {
    return "application/octet-stream";
  }
  return type;
}

// 로고/도장 이미지처럼 항상 <img>로 그대로 렌더링되는 업로드는 file.type
// 문자열만 믿지 않고 실제 파일 바이트(매직 넘버)로 진짜 래스터 이미지인지
// 확인한다 — file.type="image/svg+xml"이나 그 외 어떤 문자열이든 클라이언트가
// 자유롭게 붙일 수 있으므로, "image/"로 시작하는지만 보는 건 검증이 아니다.
const IMAGE_SIGNATURES: { type: string; magic: number[] }[] = [
  { type: "image/png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { type: "image/gif", magic: [0x47, 0x49, 0x46, 0x38] },
  { type: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
];

export async function detectRasterImageType(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const { type, magic } of IMAGE_SIGNATURES) {
    if (magic.every((byte, i) => head[i] === byte)) return type;
  }
  return null;
}
