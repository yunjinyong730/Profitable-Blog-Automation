# Profitable Blog Automation

수익화를 목표로 하되 검색 스팸이 아니라 **광범위한 기회 탐색 → 근거 수집 → 작성 → 교차 사실검증 → 시각자료 생성 → 발행**을 자동화하는 GitHub Pages 블로그입니다.

## 비용 원칙

- 유료 LLM/Search API를 사용하지 않습니다.
- public repository의 standard `ubuntu-latest` runner + 로컬 Ollama만 사용합니다.
- repository가 private이면 publish workflow가 즉시 중단됩니다.
- OpenAI API key는 필요 없습니다.

## 유입 중심 주제 탐색

매 실행마다 날짜를 기준으로 여러 pillar와 검색 의도를 회전해 8개 discovery query를 만듭니다. AI automation / local LLM / agents / coding tools / RAG / self-hosted AI / workflow orchestration 등을 comparison / alternatives / how-to / open source / cost / migration / security / benchmark / new release 같은 의도와 조합합니다.

검색된 공개 증거에서 여러 후보를 만든 뒤 `traffic potential 30% + intent 20% + freshness 15% + evidence 15% + monetization 10% + competition opportunity 10%`로 가중 점수화합니다. 최근 40개 글과 키워드/제목 유사도가 높으면 제외하며, 실제 검색량 숫자를 꾸며내지는 않습니다.

## 단계별 로컬 모델 라우팅

| 단계 | 모델 | 목적 |
|---|---|---|
| 주제 후보 생성/선정 | `qwen3:1.7b` | 빠른 후보 평가 |
| 리서치 브리프 | `qwen3:4b` | 근거 요약/불확실성 정리 |
| 본문 작성 | `qwen3:8b` | 품질이 가장 중요한 장문 작성 |
| 독립 QA | `gemma3:4b` | 다른 계열 모델로 교차검증 |

각 단계가 끝나면 모델을 runner disk에서 제거해 4개 모델을 동시에 저장하지 않습니다. 본문은 8B를 유지하고, 3개 이상의 whitelist 출처·품질점수 85점 이상·최종 본문 최소 길이 guard를 통과해야 발행됩니다.

## 시각자료

외부 이미지 자동 수집은 저작권·라이선스·핫링크 문제 때문에 기본 경로에서 제외했습니다. 대신 글의 **최종 사실검증된 내용만 사용해 코드가 직접 SVG를 생성**합니다.

- `public/assets/posts/<slug>-cover.svg`: 글 커버
- `public/assets/posts/<slug>-summary.svg`: 핵심 요약 인포그래픽
- 본문과 목록 페이지에 자동 삽입
- 모델이 SVG/HTML을 직접 쓰지 않아 스크립트 주입 위험을 줄임
- 외부 이미지 라이선스 의존 없음

향후 실제 사진이 꼭 필요한 카테고리에는 Wikimedia Commons 등에서 명시적 재사용 라이선스와 attribution metadata가 확인된 경우만 별도 opt-in 수집하는 방향이 안전합니다.

## 설정/실행

`Settings → Pages → Build and deployment → Source`를 **GitHub Actions**로 설정합니다. Actions → **Automated Blog Publisher** → Run workflow에서 `topic`을 비우면 자동 탐색, 값을 넣으면 수동 주제로 실행됩니다. 스케줄은 매일 07:30 KST입니다.
