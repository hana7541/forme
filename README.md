# FORME

디자이너를 위한 개인 디자인 레퍼런스 아카이브 웹앱.

- 화면: Next.js (App Router) + Tailwind CSS
- 데이터·로그인·이미지: Supabase (`forme-archive`, 서울 리전)
- 배포: Vercel (GitHub `main`에 올라가면 자동 배포)

## 진행 상황

- [x] STEP 01 · Supabase 프로젝트 생성
- [x] STEP 02 · 웹앱 뼈대 + GitHub · Vercel 연결
- [x] STEP 03 · 데이터베이스 구축 (테이블 9개, RLS, Storage `refs` 버킷, 가입 트리거)
- [x] STEP 04 · 회원가입 / 로그인 (Username → `username@forme.local` 내부 이메일)
- [ ] STEP 05 · 기본 레이아웃 (사이드바, 검색바, 빈 그리드, 반응형)

## 디자인 토큰

| 이름 | 값 | 쓰임 |
| --- | --- | --- |
| paper | `#FFFFFF` | 배경 |
| ink | `#000000` | 글자, 주요 버튼 |
| graphite | `#6B6B6B` | 보조 글자, 숫자 |
| hairline | `#E8E8E6` | 구분선, 테두리 |
| haze | `#F4F4F2` | 빈 칸, 선택된 메뉴 |

- 글꼴: 본문 Pretendard / 워드마크·화면 제목 Bodoni Moda + Noto Serif KR
- 색은 레퍼런스 이미지만 갖고, 화면 자체는 흑백
