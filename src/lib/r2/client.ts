import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "@/lib/server-env";

// Cloudflare R2는 S3 호환 API라 공식 AWS SDK를 그대로 쓸 수 있다 — 엔드포인트만
// R2 계정 전용 주소로 바꾸면 된다. 세금계산서 PDF, 거래명세표 이미지, 품목 도면,
// 팩스 파일처럼 Supabase 무료 플랜(500MB)을 금방 채울 무거운 바이너리 전용
// 저장소로 쓴다 — 가벼운 텍스트/관계형 데이터는 계속 Supabase DB에 둔다.
//
// R2 환경변수가 아직 설정되지 않은 배포(지금 이 저장소 포함)에서도 앱이
// 그대로 동작해야 하므로, isR2Configured()로 설정 여부를 먼저 확인하고
// 미설정 시 호출부(src/lib/storage/upload-attachment.ts)가 기존 Supabase
// Storage 경로로 자동 대체한다 — R2 키를 나중에 넣기만 하면 코드 수정 없이
// 전환된다.
function readR2Env() {
  return {
    accountId: getServerEnv("R2_ACCOUNT_ID"),
    accessKeyId: getServerEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getServerEnv("R2_SECRET_ACCESS_KEY"),
    bucket: getServerEnv("R2_BUCKET_NAME"),
  };
}

export function isR2Configured(): boolean {
  const env = readR2Env();
  return Boolean(env.accountId && env.accessKeyId && env.secretAccessKey && env.bucket);
}

let cachedClient: S3Client | null = null;
let cachedBucket = "";

// 매 호출마다 새 S3Client를 만들지 않는다 — 커넥션 풀을 재사용해야
// 서버리스/엣지 런타임에서 매 요청마다 TLS 핸드셰이크를 새로 하지 않는다.
function getClient(): { client: S3Client; bucket: string } {
  const env = readR2Env();
  if (!env.accountId || !env.accessKeyId || !env.secretAccessKey || !env.bucket) {
    throw new Error("R2 환경변수(R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME)가 설정되지 않았습니다.");
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    });
    cachedBucket = env.bucket;
  }
  return { client: cachedClient, bucket: cachedBucket };
}

export async function uploadObjectToR2(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObjectFromR2(key: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// 세금계산서 PDF 등 민감한 첨부파일을 공개 URL 없이 안전하게 내려주기 위한
// Presigned URL — 만료 시간(expiresInSeconds)이 지나면 그 링크로는 더 이상
// 접근할 수 없다. messenger-attachments처럼 공개 URL을 쓰던 버킷과 달리,
// R2로 옮기는 파일은 기본적으로 비공개 버킷을 전제로 이 방식만 쓴다.
export async function getR2DownloadUrl(key: string, expiresInSeconds = 600): Promise<string> {
  const { client, bucket } = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export type R2ObjectSummary = { key: string; lastModified: Date | undefined; size: number | undefined };

// 고아 파일 정리 스크립트(src/lib/r2/sweep-orphans.ts)가 "버킷에 실제로
// 있는 것" 전체 목록을 얻는 용도로만 쓴다 — 버킷 안 객체 수가 많아지면
// ListObjectsV2가 한 번에 최대 1000개만 돌려주므로 ContinuationToken으로
// 끝까지 페이지네이션한다. onApiCall은 R2 쓰기(Class A) 호출횟수 집계용
// (src/lib/r2/sweep-orphans.ts) — ListObjectsV2도 Class A 과금 대상이라
// 페이지를 넘길 때마다 실제로 몇 번 호출했는지 호출부에 그대로 알려준다.
export async function listAllR2Objects(opts?: { onApiCall?: () => void }): Promise<R2ObjectSummary[]> {
  const { client, bucket } = getClient();
  const objects: R2ObjectSummary[] = [];
  let continuationToken: string | undefined;
  do {
    opts?.onApiCall?.();
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) objects.push({ key: obj.Key, lastModified: obj.LastModified, size: obj.Size });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}
