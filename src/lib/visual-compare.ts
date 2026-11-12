import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

// 화면 비교 안전망(e2e-visual)이 쓰는 두 이미지 비교 함수. 같은 화면을 "배포된 버전"과
// "수정한 버전"으로 각각 찍은 PNG를 받아 달라진 픽셀 비율을 돌려준다. 크기(가로/세로)가
// 다르면 화면 구성이 달라진 것이므로 비율 1(완전히 다름)로 본다.
export type VisualDiff = {
  ratio: number; // 0 = 완전히 같음, 1 = 완전히 다름
  diffPixels: number;
  totalPixels: number;
  sameSize: boolean;
  diffPng: Buffer | null; // 다른 부분을 빨갛게 표시한 이미지(같은 크기일 때만)
};

export function compareScreenshots(a: Buffer, b: Buffer, threshold = 0.1): VisualDiff {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return { ratio: 1, diffPixels: -1, totalPixels: Math.max(imgA.width * imgA.height, imgB.width * imgB.height), sameSize: false, diffPng: null };
  }
  const diff = new PNG({ width: imgA.width, height: imgA.height });
  const diffPixels = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold });
  const totalPixels = imgA.width * imgA.height;
  return { ratio: diffPixels / totalPixels, diffPixels, totalPixels, sameSize: true, diffPng: diffPixels > 0 ? PNG.sync.write(diff) : null };
}
