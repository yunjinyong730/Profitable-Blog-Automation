# Profitable Blog Automation

수익화를 목표로 하되 검색 스팸이 아니라 **광범위한 기회 탐색 → 근거 수집 → 작성 → 교차 사실검증 → 시각자료/라이선스 사진 처리 → 발행**을 자동화하는 GitHub Pages 블로그입니다.

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
| 독립 QA + 사진 필요성 판단 | `gemma3:4b` | 다른 계열 모델로 교차검증 |

각 단계가 끝나면 모델을 runner disk에서 제거해 4개 모델을 동시에 저장하지 않습니다. 본문은 8B를 유지하고, 3개 이상의 whitelist 출처·품질점수 85점 이상·최종 본문 최소 길이 guard를 통과해야 발행됩니다.

## 시각자료와 Wikimedia Commons 사진

기본 시각자료는 글의 최종 사실검증된 내용으로 자체 SVG 커버와 요약 인포그래픽을 생성합니다. 여기에 **실제 사진이 이해를 materially 개선하는 경우만** QA 단계에서 사진 검색을 요청합니다.

사진 자동화 정책:
- Wikimedia Commons만 사용
- `imageinfo + extmetadata`로 라이선스/저자/원본 페이지를 확인
- 허용: `CC0`, `Public domain`, `CC BY`, `CC BY-SA`
- 자동 거부: `NC`, `ND`, 알 수 없는 라이선스, 제한사항이 명시된 파일, 로고/아이콘/다이어그램/스크린샷 등
- 저자 표시가 필요한데 저자 정보가 없으면 사용하지 않음
- 1200px thumbnail을 **로컬 `public/assets/posts/`에 저장**해 핫링크하지 않음
- `data/media/<slug>.json`에 저자, 라이선스, 라이선스 URL, Commons 원본 페이지, 원본 파일 URL, SHA-256, 수집 시각을 보관
- 글의 이미지 caption에 저자/라이선스/원본 링크를 자동 표시
- 조건을 만족하는 사진이 없으면 사진 없이 기존 SVG 시각자료만 사용하고 발행은 계속 진행

생성 파일:
- `public/assets/posts/<slug>-cover.svg`: 글 커버
- `public/assets/posts/<slug>-summary.svg`: 핵심 요약 인포그래픽
- 필요 시 `public/assets/posts/<slug>-commons.(jpg|png|webp)`: 검증된 Commons 사진
- 필요 시 `data/media/<slug>.json`: 라이선스 감사 기록

## 수익화

수익화는 광고보다 **제휴 → 디지털 상품 → 컨설팅/리드 → 스폰서십 → 디스플레이 광고** 순으로 설계합니다. 검색의도별 수익화 매핑, 90일 운영 계획, KPI, 성과 피드백 전략은 [`docs/MONETIZATION.md`](docs/MONETIZATION.md)에 정리되어 있습니다.

현재 코드에서는 실제 승인된 제휴 URL만 `AFFILIATE_LINKS_JSON`으로 연결하며, AdSense는 `ADSENSE_CLIENT` / `ADSENSE_SLOT`을 설정한 경우에만 렌더링합니다.

## 설정/실행

`Settings → Pages → Build and deployment → Source`를 **GitHub Actions**로 설정합니다. Actions → **Automated Blog Publisher** → Run workflow에서 `topic`을 비우면 자동 탐색, 값을 넣으면 수동 주제로 실행됩니다. 스케줄은 매일 07:30 KST입니다.
