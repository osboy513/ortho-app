# 정형외과 SCI 저널 논문 뷰어

NCBI PubMed와 AI를 활용한 정형외과 SCI 저널 논문 검색 및 요약 도구입니다.

## 기능

- 다양한 정형외과 관련 SCI 저널에서 논문 검색
- 발행일 기반 필터링
- 키워드 검색
- 논문 초록 AI 요약 기능
- 모바일 친화적 반응형 디자인
- PWA(Progressive Web App) 지원 - 오프라인 기능 및 홈 화면 설치 가능

## 아이폰에서 웹앱 사용하기

### 웹 호스팅 방법

이 웹앱은 GitHub Pages, Netlify, Vercel 등의 정적 웹사이트 호스팅 서비스를 통해 배포할 수 있습니다.

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

- HTML, CSS, JavaScript로 개발된 클라이언트 측 웹앱
- Tailwind CSS를 활용한 UI 디자인
- NCBI PubMed API를 통한 논문 검색
- OpenAI API를 통한 논문 요약
- PWA 기능 - 서비스 워커, 매니페스트 파일, 앱 아이콘 포함

## 로컬에서 실행하기

로컬 개발 서버를 실행하려면:

```bash
# http-server가 설치되어 있지 않은 경우
npm install -g http-server

# 프로젝트 루트 디렉토리에서 실행
http-server
```

브라우저에서 `http://localhost:8080`으로 접속하여 웹앱을 확인할 수 있습니다.

## 라이선스

MIT 