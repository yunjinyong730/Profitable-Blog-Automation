# Profitable Blog Automation

수익화를 목표로 하되 검색 스팸이 아니라 **무료 공개 웹 리서치 → 로컬 LLM 작성 → 독립 QA → 품질 게이트 → 발행**을 자동화하는 전용 블로그 저장소입니다.

## 비용 원칙

이 버전은 OpenAI API, 유료 검색 API, 유료 LLM API를 호출하지 않습니다. 기본 실행 경로는 **public GitHub repository의 standard `ubuntu-latest` runner + Ollama + Qwen3:8b + GitHub Pages**입니다.

- OpenAI API key: 필요 없음
- 외부 LLM API 결제: 없음
- 유료 검색 API: 사용하지 않음
- 모델: `qwen3:8b`를 매 실행 시 GitHub runner에 로컬로 pull
- 검색/리서치: DuckDuckGo HTML 결과(최선 노력), GitHub Search API, Hacker News Algolia API 및 결과 원문 페이지
- GitHub Pages: 정적 `public/` 디렉터리 배포

워크플로는 저장소가 private으로 바뀌면 즉시 실패하도록 **zero-cost guard**를 넣었습니다. `runs-on: ubuntu-latest`만 사용하며 larger runner는 사용하지 않습니다. GitHub의 과금 정책은 향후 바뀔 수 있으므로 정책 자체까지 영구 보장할 수는 없지만, 현재 코드에는 결제형 API나 유료 runner를 호출하는 경로가 없습니다.

## 자동화 흐름

1. 큐/수동 주제가 없으면 무료 공개 소스에서 최근 후보를 수집합니다.
2. 로컬 Qwen3:8b가 후보 근거만 보고 주제를 하나 고릅니다.
3. 선택한 주제로 다시 공개 웹 자료를 수집합니다.
4. Qwen3:8b가 수집된 URL과 본문만 근거로 리서치 브리프를 만듭니다.
5. 별도 호출로 한국어 장문 글을 작성합니다.
6. 다시 별도 호출로 QA/사실검증을 수행합니다.
7. 검증 출처가 3개 미만이거나 품질점수가 85/100 미만이면 발행하지 않습니다.
8. 통과하면 HTML, RSS, sitemap, robots.txt를 갱신하고 GitHub Pages에 배포합니다.

## 1회 설정

### GitHub Pages

`Settings → Pages → Build and deployment → Source`를 **GitHub Actions**로 설정합니다.

### API key

**필요 없습니다.** `OPENAI_API_KEY` secret은 삭제해도 됩니다.

### 선택적 수익화

`Settings → Secrets and variables → Actions`에 아래 항목을 선택적으로 설정할 수 있습니다.

- `ADSENSE_CLIENT`
- `ADSENSE_SLOT`
- `AFFILIATE_LINKS_JSON`

Repository variable로 `AFFILIATE_DISCLOSURE`도 선택적으로 지정할 수 있습니다.

## 실행

Actions 탭의 **Automated Blog Publisher**에서 수동 실행할 수 있습니다. `topic`을 비워두면 무료 공개 소스를 수집한 뒤 모델이 주제를 고르고, 값을 입력하면 해당 주제를 우선 사용합니다.

스케줄은 `30 22 * * *` UTC, 즉 한국시간 매일 07:30입니다.

## 로컬 실행

Linux/macOS/Windows에서 Ollama를 설치한 뒤:

```bash
ollama pull qwen3:8b
ollama serve
```

다른 터미널에서:

```bash
npm run validate
npm run publish:blog
```

필요하면 `.env.example`의 값을 환경변수로 지정할 수 있습니다. 기본 Ollama 주소는 `http://127.0.0.1:11434`입니다.

## 데이터 구조

- `config/blog.config.json`: 사이트/품질/로컬 모델/무료 검색 설정
- `data/topic-queue.json`: 우선 처리할 주제 큐
- `data/posts.json`: 게시물 메타데이터
- `data/articles/*.json`: 주제, 공개 웹 근거, 초안, QA 기록
- `public/`: GitHub Pages 정적 사이트
- `src/research.mjs`: 무료 공개 웹 자료 수집
- `src/ollama.mjs`: 로컬 Ollama Structured Outputs 호출
- `src/pipeline.mjs`: end-to-end 파이프라인

## 안전장치

- 의료·법률·개인화 투자 등 YMYL 주제 기본 제외
- 모델이 임의 URL을 출처로 만들지 못하도록 **실제로 수집된 URL만 whitelist**
- 검증 가능한 서로 다른 출처 최소 3개 요구
- 최소 품질 점수 85/100
- 모델이 raw HTML을 생성하지 않고 구조화된 JSON을 생성한 뒤 코드가 HTML escape
- localhost/private network URL 수집 차단
- private repository에서 자동 실행 차단

## 현실적인 한계

완전 무료 구조는 유료 검색/대형 모델보다 품질과 안정성이 낮을 수 있습니다. DuckDuckGo가 자동 요청을 차단하거나 공개 API가 일시적으로 제한되면 GitHub/Hacker News 결과만 사용하게 되며, 충분한 출처를 못 모으면 **발행하지 않고 실패**하는 쪽으로 설계했습니다. Qwen3:8b는 CPU runner에서 느릴 수 있으므로 하루 1개 발행을 기본값으로 유지합니다.
