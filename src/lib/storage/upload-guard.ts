// 모든 첨부파일 업로드(uploadAttachment)가 거치는 파일 종류/크기 검사.
// 쿼터(용량) 검사만 있고 "무슨 파일이든" 올릴 수 있었다 — 실행 파일이나 HTML/스크립트
// 파일을 올려 다른 직원에게 열어보게 하는 공격(피싱·악성코드 배포)을 막는다.
// 확장자 기준 차단 목록 방식이라 업무에 쓰는 문서/이미지/압축 파일은 그대로 된다.
// (xml은 전자세금계산서 파일로 업무에서 주고받으므로 막지 않는다.)
const BLOCKED_EXTENSIONS = new Set([
  // 브라우저에서 스크립트로 실행될 수 있는 파일
  "html", "htm", "xhtml", "shtml", "js", "mjs", "svg", "swf",
  // 윈도우/맥/리눅스 실행 파일·스크립트
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "ps1", "vbs", "vbe", "wsf", "jar", "dll",
  "sh", "app", "apk", "dmg", "lnk", "reg", "hta",
]);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 서버 액션 본문 한도(20MB)보다 약간 넉넉하게

const BLOCKED_CONTENT_TYPES = [
  "text/html", "application/xhtml+xml", "image/svg+xml", "application/javascript",
  "text/javascript", "application/x-msdownload", "application/x-sh", "application/x-msdos-program",
];

export function checkUploadAllowed(opts: {
  path: string;
  contentType: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (opts.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "파일이 너무 큽니다(최대 25MB)." };
  }
  // 경로 끝의 마지막 확장자 + 이중 확장자(report.html.txt 같은 우회)의 모든 조각을 검사한다.
  const fileName = opts.path.split("/").pop() ?? "";
  const parts = fileName.toLowerCase().split(".").slice(1);
  if (parts.some((ext) => BLOCKED_EXTENSIONS.has(ext.trim()))) {
    return { ok: false, error: "보안상 올릴 수 없는 파일 형식입니다(실행/스크립트 파일)." };
  }
  const ct = opts.contentType.toLowerCase().split(";")[0].trim();
  if (BLOCKED_CONTENT_TYPES.includes(ct)) {
    return { ok: false, error: "보안상 올릴 수 없는 파일 형식입니다(실행/스크립트 파일)." };
  }
  return { ok: true };
}
