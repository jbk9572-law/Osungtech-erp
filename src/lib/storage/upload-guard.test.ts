import { describe, expect, it } from "vitest";
import { checkUploadAllowed, MAX_UPLOAD_BYTES } from "./upload-guard";

const ok = (path: string, contentType = "application/octet-stream", size = 100) =>
  checkUploadAllowed({ path, contentType, size });

describe("checkUploadAllowed", () => {
  it("업무 문서/이미지/압축 파일은 허용한다", () => {
    for (const p of ["a/견적서.pdf", "a/b.xlsx", "a/c.docx", "a/d.png", "a/e.jpg", "a/f.zip", "a/g.hwp", "a/h.csv", "a/세금계산서.xml"]) {
      expect(ok(p).ok).toBe(true);
    }
  });
  it("실행/스크립트 파일은 거부한다", () => {
    for (const p of ["a/x.exe", "a/x.html", "a/x.SVG", "a/x.js", "a/x.bat", "a/x.ps1", "a/x.sh", "a/x.jar"]) {
      expect(ok(p).ok).toBe(false);
    }
  });
  it("이중 확장자 우회(report.html.txt)도 거부한다", () => {
    expect(ok("a/report.html.txt").ok).toBe(false);
    expect(ok("a/invoice.pdf.exe").ok).toBe(false);
  });
  it("콘텐츠 타입이 html/svg면 이름과 관계없이 거부한다", () => {
    expect(ok("a/noext", "text/html; charset=utf-8").ok).toBe(false);
    expect(ok("a/pic", "image/svg+xml").ok).toBe(false);
  });
  it("너무 큰 파일은 거부한다", () => {
    expect(ok("a/big.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1).ok).toBe(false);
    expect(ok("a/big.pdf", "application/pdf", MAX_UPLOAD_BYTES).ok).toBe(true);
  });
});
