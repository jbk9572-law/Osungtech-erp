# 오라클 클라우드 무료 서버로 셀프호스팅하기 (비용 $0)

Vercel/Supabase 유료 결제 없이, 오라클 클라우드의 평생 무료(Always Free)
서버에 이 앱을 직접 올려서 운영하는 방법이다. 3인 내외의 사내 사용
기준으로 작성했다.

## 전체 구조

- **Oracle Cloud 무료 ARM 서버(Ubuntu)**: Next.js 앱을 Docker로 실행
- **Caddy**: 앞단에서 HTTPS(무료 인증서)를 자동으로 처리해서 앱으로
  넘겨준다
- **DuckDNS**: 무료 서브도메인(예: `osungtech-erp.duckdns.org`) —
  Let's Encrypt 인증서를 받으려면 IP 주소만으론 안 되고 도메인이
  있어야 한다
- **Supabase**: DB/인증/파일저장은 그대로 무료 플랜 사용, 대신 7일
  자동정지를 막기 위해 GitHub Actions로 주기적으로 핑을 보낸다

## 1. Oracle Cloud 계정 만들기

1. https://www.oracle.com/cloud/free/ 에서 가입 (카드 등록은 본인확인용,
   Always Free 자원만 쓰면 과금되지 않는다)
2. 가입 시 리전은 서울(Seoul) 또는 가장 가까운 리전으로 선택

## 2. 무료 서버(인스턴스) 만들기

1. Oracle Cloud 콘솔 > Compute > Instances > **Create Instance**
2. 이미지: **Ubuntu 24.04**, 모양(Shape): **VM.Standard.A1.Flex**
   (Always Free), OCPU 2 / 메모리 12GB로 설정 (Always Free 한도)
3. SSH 키 생성 및 다운로드(접속용 — 잃어버리면 서버에 못 들어간다)
4. 생성 후 **공개 IP 주소**를 메모해둔다

## 3. 방화벽에서 80/443 포트 열기

1. 인스턴스 상세 > **Subnet** > **Security List** > Ingress Rules 추가
   - 0.0.0.0/0 → TCP 80 (HTTP)
   - 0.0.0.0/0 → TCP 443 (HTTPS)
2. 서버 안에서도 우분투 방화벽이 막을 수 있으니 서버 접속 후:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw allow OpenSSH
   ```

## 4. 무료 도메인 연결 (DuckDNS)

1. https://www.duckdns.org 에서 (구글 계정 등으로) 가입
2. 원하는 서브도메인 입력 (예: `osungtech-erp`) → `osungtech-erp.duckdns.org`
   생성
3. "current ip"에 2단계에서 메모한 오라클 서버 공개 IP 입력 후 저장

## 5. 서버에 Docker 설치

SSH로 서버 접속 후:

```bash
ssh -i <다운받은키.pem> ubuntu@<서버 공개 IP>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 재접속해야 docker 명령이 sudo 없이 됨
exit
```

## 6. 저장소 내려받고 설정

다시 서버에 접속한 뒤:

```bash
git clone https://github.com/jbk9572-law/Osungtech-erp.git
cd Osungtech-erp
cp .env.production.example .env.production
nano .env.production   # NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SITE_DOMAIN 채우기
```

`SITE_DOMAIN`은 4단계에서 만든 DuckDNS 주소(`osungtech-erp.duckdns.org`)를
넣는다.

## 7. 실행

```bash
export $(cat .env.production | xargs)
docker compose up -d --build
```

몇 분 뒤 `https://<SITE_DOMAIN>` 으로 접속하면 로그인 화면이 뜬다.
Caddy가 첫 접속 시 자동으로 Let's Encrypt 인증서를 발급받는다.

## 8. Supabase 자동 일시정지 막기 (GitHub Actions)

1. GitHub 저장소 > Settings > Secrets and variables > Actions
2. `SUPABASE_URL`, `SUPABASE_ANON_KEY` 두 개 등록 (Supabase 대시보드 >
   Project Settings > API 값 그대로)
3. `.github/workflows/supabase-keepalive.yml`이 3일마다 자동으로 핑을
   보낸다 (이미 저장소에 포함됨, 별도 설정 불필요)

## 9. 업데이트하는 방법

코드가 바뀐 뒤 서버에 반영하려면:

```bash
cd Osungtech-erp
git pull
export $(cat .env.production | xargs)
docker compose up -d --build
```

## 참고: 이 방식의 한계

- 서버가 죽거나 오라클 쪽 장애가 나면 자동 복구가 안 된다(관리형
  서비스가 아니라서). 재부팅/재시작을 직접 해야 할 수 있다.
- 백업이 자동이 아니다 — DB는 Supabase가 관리하니 상관없지만, 서버
  자체(예: Caddy 인증서)가 날아가면 다시 발급받으면 된다(자동 재발급됨).
- Oracle Always Free 한도(2 OCPU/12GB, 200GB 저장공간)를 초과하는
  일은 3인 사용 규모에선 거의 없다.
