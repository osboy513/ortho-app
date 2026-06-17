# 정형외과 SCI 저널 논문 뷰어

NCBI PubMed와 AI를 활용한 정형외과 SCI 저널 논문 검색 및 요약 도구입니다.

## 기능

- 다양한 정형외과 관련 SCI 저널에서 논문 검색
- 발행일 기반 필터링
- 키워드 검색
- 자연어 질문을 PubMed 검색식으로 변환하는 AI 검색 모드
- 서버리스 기반 논문 초록 AI 근거 요약 기능
- 사용자별 OpenAI/Gemini API 키 및 모델 선택 지원
- 운영자 API 키를 fallback으로 사용할 수 있는 보안 구조
- PMID/model/prompt version 기반 요약 캐싱
- 모바일 친화적 반응형 디자인
- PWA(Progressive Web App) 지원 - 오프라인 기능 및 홈 화면 설치 가능

## v2.0+ 요약 구조

AI API는 브라우저에서 직접 호출하지 않습니다. 프론트엔드는 논문 제목, PMID, 초록과 사용자가 설정한 AI 제공자/모델 정보를 `/api/summarize`로 보내고, 서버리스 함수가 OpenAI 또는 Gemini API를 호출합니다. AI 검색 모드는 자연어 질문을 `/api/search-query`로 보내 PubMed Boolean 검색식으로 변환합니다. 사용자가 API 키를 저장한 경우 해당 키를 우선 사용하고, 없으면 운영자 환경변수의 OpenAI 키를 fallback으로 사용할 수 있습니다.

요약 프롬프트는 초록에 근거한 내용만 반환하도록 제한되어 있으며, 결과는 다음 구조로 렌더링됩니다.

- Clinical relevance
- Key points
- Limitations
- Confidence

## 사용자 API 키 방식

설정 탭에서 사용자가 직접 AI 제공자와 모델을 선택하고 API 키를 저장할 수 있습니다.

- 지원 제공자: OpenAI, Google Gemini
- API 키는 해당 브라우저의 `localStorage`에 저장됩니다.
- 요약 및 AI 검색 요청 시 API 키가 이 앱의 서버리스 함수로 전송됩니다.
- 서버는 사용자 API 키를 저장하지 않습니다.
- API 키를 입력하지 않으면 운영자 환경변수의 OpenAI 키를 fallback으로 사용할 수 있습니다.

정적 서버(`npm run start:static`)에서는 `/api/summarize`, `/api/search-query`가 없으므로 AI 요약과 AI 검색은 동작하지 않습니다. 사용자 API 키 방식도 Vercel 개발 서버 또는 배포 환경처럼 서버리스 함수가 실행되는 환경이 필요합니다.

## Vercel 배포 환경변수

운영자 fallback 요약 기능을 제공하려면 Vercel 프로젝트의 Settings > Environment Variables에 아래 값을 등록하세요.

```bash
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-5.5
SUMMARY_CACHE_TTL_SECONDS=2592000
SUMMARY_RATE_LIMIT=30
```

서버 간 지속 캐시가 필요하면 Upstash Redis 값을 추가로 등록할 수 있습니다.

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## 아이폰에서 웹앱 사용하기

### 웹 호스팅 방법

AI 요약과 AI 검색 기능까지 사용하려면 Vercel처럼 `/api/*` 서버리스 함수를 지원하는 호스팅을 사용해야 합니다. GitHub Pages 같은 정적 호스팅에서는 일반 PubMed 검색은 가능하지만 AI API는 동작하지 않습니다.

#### GitHub Pages 배포 방법

1. GitHub에 새 리포지토리 생성
2. 이 프로젝트 파일을 리포지토리에 업로드
3. 리포지토리 설정에서 GitHub Pages 활성화
   - Settings > Pages > Source에서 배포 브랜치 선택 (보통 main 또는 master)
4. 몇 분 후 GitHub에서 제공하는 URL로 웹앱에 접속 가능 (예: https://username.github.io/repository-name/)

### 아이폰에서 '앱처럼' 사용하는 방법

1. Safari 브라우저로 웹앱 URL 접속
2. 하단 공유 버튼(↑) 탭
3. '홈 화면에 추가' 선택
4. 원하는 경우 앱 이름 변경 후 '추가' 버튼 클릭
5. 이제 홈 화면에서 앱 아이콘을 탭하여 독립 창으로 웹앱 실행 가능

## 개발 정보

- HTML, CSS, JavaScript와 Vercel 서버리스 함수로 개발된 웹앱
- Tailwind CSS를 활용한 UI 디자인
- NCBI PubMed API를 통한 논문 검색
- OpenAI/Gemini API를 통한 AI 검색식 생성 및 논문 요약
- PWA 기능 - 서비스 워커, 매니페스트 파일, 앱 아이콘 포함

## 로컬에서 실행하기

의존성을 설치한 뒤 Vercel 개발 서버를 실행하면 `/api/summarize`, `/api/search-query`까지 함께 테스트할 수 있습니다.

```bash
npm install
cp .env.example .env.local

npm run dev
```

브라우저에서 `http://localhost:8080`으로 접속하여 웹앱을 확인할 수 있습니다.

정적 화면만 확인하려면 아래 명령을 사용할 수 있습니다.

```bash
npm run start:static
```

이 경우 AI API는 사용할 수 없습니다.

## 라이선스

MIT
