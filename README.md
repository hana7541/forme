# FORME

디자이너를 위한 개인 디자인 레퍼런스 아카이브 웹앱.

- 주소: https://forme-ruby-zeta.vercel.app
- 화면: Next.js (App Router) + Tailwind CSS
- 데이터·로그인·이미지: Supabase (`forme-archive`, 서울 리전)
- 배포: Vercel (GitHub `main`에 올라가면 자동 배포)

## 진행 상황

- [x] STEP 01 · Supabase 프로젝트 생성
- [x] STEP 02 · 웹앱 뼈대 + GitHub · Vercel 연결
- [x] STEP 03 · 데이터베이스 구축 (테이블 9개, RLS, Storage `refs` 버킷, 가입 트리거)
- [x] STEP 04 · 회원가입 / 로그인 (Username → `username@forme.local` 내부 이메일)
- [x] STEP 05 · 기본 레이아웃 (사이드바, 검색바, 빈 그리드, 반응형)
- [x] STEP 06 · 이미지 업로드 (여러 장, 드래그 앤 드롭, 붙여넣기, 썸네일 자동 생성) + 메이슨리 그리드
- [x] STEP 07 · 상세 보기 / 편집 (제목, 메모, 출처, 카테고리, 태그, 즐겨찾기, 삭제)
- [x] STEP 08 · URL로 저장 (이미지 주소, 웹페이지 대표 이미지)
- [x] STEP 09 · 검색 · 걸러내기 · 여러 장 선택
- [x] STEP 10 · 컬렉션
- [x] STEP 11 · 무드보드
- [x] STEP 12 · 설정 + ZIP 백업/복원
- [x] STEP 13 · 마무리 점검

## 쓰는 법

| 하고 싶은 것 | 방법 |
| --- | --- |
| 이미지 올리기 | 업로드 버튼, 화면에 끌어다 놓기, Cmd + V |
| 웹에서 바로 저장 | 이미지·웹페이지 주소를 Cmd + V, 또는 업로드 > 주소로 저장 |
| 검색 | Cmd + K, 제목·메모·출처·태그에서 찾음 |
| 여러 장 한꺼번에 | 목록 위 ‘선택’ → Shift + 클릭으로 범위, Cmd + A로 전부 |
| 자세히 보기 | 이미지 클릭, ← → 로 옆 이미지, Esc로 닫기 |
| 무드보드 | 빈 곳 끌기 = 화면 이동, 핀치 = 확대, Delete = 빼기, [ ] = 겹침 순서 |
| 백업 | 설정 > 백업과 복원 |

## 구조

```
app/
  (auth)/login, signup        로그인 · 가입
  (app)/page.tsx              라이브러리 (전체 · 즐겨찾기 · 카테고리 · 태그 · 검색)
  (app)/collections           컬렉션 목록 · 상세
  (app)/moodboards            무드보드 목록 · 편집
  (app)/settings              설정 · 백업
  api/fetch-image             주소로 저장 (서버에서 받아 Storage에 넣음)
components/                   화면 조각
lib/                          Supabase와 주고받는 도구
```

## 디자인 토큰

| 이름 | 값 | 쓰임 |
| --- | --- | --- |
| paper | `#FFFFFF` | 배경 |
| ink | `#000000` | 글자, 주요 버튼 |
| graphite | `#6B6B6B` | 보조 글자, 숫자 |
| hairline | `#E8E8E6` | 구분선, 테두리 |
| haze | `#F4F4F2` | 빈 칸, 선택된 메뉴 |

- 글꼴: Pretendard 하나로 통일 (큰 제목은 굵고 촘촘한 자간)
- 색은 레퍼런스 이미지만 갖고, 화면 자체는 흑백

## 데이터 보호

- 모든 테이블과 Storage에 RLS: 내 데이터는 내 로그인으로만 읽고 쓸 수 있음
- 이미지는 비공개 버킷, 1시간짜리 임시 주소로만 열람
- 주소로 저장은 로그인 확인 + 내부망 주소 차단 + 20MB · 15초 제한
