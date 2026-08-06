// 영수증 사진처럼 "글자만 읽히면 되는" 이미지를 업로드 전에 브라우저에서
// 줄여서 올린다. 폰 카메라 원본(장당 3~8MB)을 압축 없이 그대로 올리면
// Supabase 무료 플랜 Storage(1GB)가 금방 찬다 — 가로/세로를 최대
// maxDimension으로 줄이고 JPEG로 재압축하면 장당 대략 150~300KB로
// 줄어들어 같은 용량으로 훨씬 많은 영수증을 감당할 수 있다.
// 압축에 실패하면(브라우저 미지원 등) 원본 파일을 그대로 반환한다 —
// 압축은 최적화일 뿐 업로드 자체를 막을 이유는 아니다.
export async function compressImage(
  file: File,
  { maxDimension = 1600, quality = 0.72 }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  try {
    // imageOrientation: "from-image"로 EXIF 회전 정보를 반영해야, 세로로
    // 찍은 영수증 사진이 눕지 않는다.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^./\\]+$/, "") || "receipt";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
