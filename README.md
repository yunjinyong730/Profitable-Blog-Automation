# Profitable Blog Automation

수익화를 목표로 하되 검색 스팸이 아니라 **리서치 → 작성 → 독립 사실검증 → 품질 게이트 → 발행 → 향후 성과 피드백**을 자동화하는 전용 블로그 저장소입니다.

## 현재 MVP가 자동화하는 것

- 최신 웹검색을 이용한 주제 기회 발굴
- 공식/1차 출처 중심의 리서치 브리프 생성
- 한국어 장문 글 작성
- 별도 AI 호출로 사실검증 및 편집
- 품질 점수 85/100 미만 자동 발행 차단
- 구조화된 콘텐츠를 HTML escape하여 모델 생성 HTML/스크립트 주입 방지
- 정적 블로그, RSS, sitemap, robots.txt 자동 생성
- GitHub Actions 매일 07:30 KST 자동 실행
- GitHub Pages 배포
- 선택적 AdSense/제휴 링크 삽입
- 수동 주제 override 및 `data/topic-queue.json` 큐 지원

## 1회 설정

### Repository secrets

`Settings → Secrets and variables → Actions`에 다음을 설정합니다.

- `OPENAI_API_KEY` (필수)
- `ADSENSE_CLIENT` (선택)
- `ADSENSE_SLOT` (선택)
- `AFFILIATE_LINKS_JSON` (선택, `config/monetization.example.json` 형식 참고)

Repository variable로 `AFFILIATE_DISCLOSURE`를 선택적으로 지정할 수 있습니다.

### GitHub Pages

`Settings → Pages → Build and deployment → Source`를 **GitHub Actions**로 설정합니다.

## 실행

Actions 탭의 **Automated Blog Publisher**를 수동 실행할 수 있습니다. `topic`을 비워두면 AI가 현재 웹을 조사해 주제를 선택하고, 값을 넣으면 해당 주제를 강제로 사용합니다.

스케줄은 `30 22 * * *` UTC이며 한국시간으로 매일 07:30입니다.

## 데이터 구조

- `config/blog.config.json`: 사이트/주제/품질/모델 설정
- `data/topic-queue.json`: 우선 처리할 주제 큐
- `data/posts.json`: 게시물 메타데이터
- `data/articles/*.json`: 각 글의 주제, 리서치, 초안, QA 기록
- `public/`: GitHub Pages에 배포되는 정적 사이트
- `src/pipeline.mjs`: end-to-end 자동화 파이프라인

## 모델

기본값은 `gpt-5.6-terra`입니다. 비용/품질 전략에 따라 `config/blog.config.json`에서 변경할 수 있습니다.

## 안전장치

이 시스템은 의료·법률·개인화 투자 등 YMYL 범주를 기본 주제 선정에서 제외하고, 최소 3개의 검증 가능한 HTTP(S) 출처와 품질 게이트를 요구합니다. AI가 직접 HTML을 생성하지 않고 구조화된 섹션을 생성한 뒤 코드가 escape하여 렌더링합니다.

## 다음 단계

MVP 이후에는 Google Search Console/GA4 데이터를 수집해 `노출↑ + CTR↓ → 제목 개선`, `순위 4~15위 → 본문 보강`, `수익 높은 클러스터 → 후속 주제 생성` 같은 성과 피드백 루프를 추가하는 것이 목표입니다.
