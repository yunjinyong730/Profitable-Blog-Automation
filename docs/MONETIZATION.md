# 수익화 운영 계획

이 블로그의 목표는 "많은 글을 자동 생성해서 광고 노출을 늘리는 것"이 아니라, **검색 유입을 가진 고품질 기술 콘텐츠를 자산으로 쌓고 구매의도가 높은 독자에게 적합한 수익화 경로를 연결하는 것**입니다. 모든 수치는 목표/가설이며 수익을 보장하지 않습니다.

## 1. 수익원 우선순위

### 1) 제휴(affiliate) — 초기 최우선
AI 자동화/개발 도구 블로그는 `비교`, `alternatives`, `가격`, `self-hosted`, `how-to` 검색의도가 실제 도구 선택과 가까워 제휴 링크를 자연스럽게 연결하기 좋습니다.

운영 원칙:
- 실제로 글에서 다룬 도구만 연결합니다.
- 제휴 링크 때문에 평가를 바꾸지 않습니다.
- 제휴 프로그램이 있다고 해서 얕은 제품 목록 글을 만들지 않습니다.
- 글 상단이 아니라 **결정에 도움이 되는 비교/결론 구간**에 CTA를 둡니다.
- 모든 제휴 링크는 `rel="sponsored nofollow"`와 고지문을 유지합니다.

우선 대상으로 볼 카테고리:
- 자동화 SaaS / workflow 도구
- AI coding / developer productivity 도구
- hosting / VPS / cloud / managed database
- observability / monitoring / security 도구
- AI/RAG 관련 SaaS 중 실제 제휴 프로그램이 있는 제품

현재 저장소에서는 `AFFILIATE_LINKS_JSON`으로 승인된 실제 제휴 URL만 넣습니다. 존재하지 않는 프로그램이나 임의의 제휴 URL을 만들어 넣지 않습니다.

### 2) 디지털 상품 — 장기 수익성의 핵심
광고와 제휴는 플랫폼 정책/수수료율에 의존합니다. 자체 상품을 추가하면 방문당 수익을 높이고 외부 프로그램 의존도를 줄일 수 있습니다.

이 블로그와 가장 잘 맞는 상품 후보:
- n8n / Make / GitHub Actions 자동화 workflow 묶음
- Ollama / RAG / local AI 배포 템플릿
- AI 자동화 설계 체크리스트
- 도구 비교 평가표 / 도입 의사결정 템플릿
- 소규모 팀용 AI 업무자동화 starter kit
- 기술팀용 운영 runbook / security checklist

무료 글은 문제 해결 전체 흐름을 충분히 제공하고, 유료 상품은 **시간을 절약하는 실행 가능한 파일/템플릿/패키지**를 판매해야 합니다. 핵심 정보를 일부러 숨겨 상품 구매를 강요하지 않습니다.

### 3) 컨설팅/리드 — 트래픽이 작아도 가능한 고단가 채널
기술 독자가 실제 도입을 검토하는 주제에서 문의로 전환할 수 있습니다.

예:
- 사내 AI 자동화 설계
- n8n / Make / GitHub Actions 워크플로 구축
- local LLM / RAG PoC
- AI 개발도구 도입 평가
- self-hosted AI 보안/운영 설계

초기에는 별도 영업 페이지 대신 "이 유형의 구축이 필요하면 문의" 정도의 단순 CTA부터 시작합니다. 실제 서비스 제공 의사가 있을 때만 활성화합니다.

### 4) 스폰서십 — 반복 유입이 생긴 뒤
특정 주제 클러스터에서 꾸준한 검색 유입이 생기면 관련 SaaS/도구 업체에 스폰서 슬롯을 판매할 수 있습니다.

원칙:
- 스폰서 글과 일반 편집 글을 명확히 구분합니다.
- 스폰서가 사실검증 결론을 통제하지 못하게 합니다.
- 방문자에게 광고/협찬임을 명시합니다.

### 5) 디스플레이 광고 — 가장 늦게
AdSense는 보조 수익원으로 봅니다. 초기부터 광고 밀도를 높이면 UX와 전환을 해칠 수 있으므로, 충분한 고품질 콘텐츠와 안정적 유입이 생긴 뒤 선택적으로 켭니다.

광고 수익 공식:

`광고수익 ≈ 페이지뷰 / 1000 × 실제 Page RPM`

실제 RPM은 국가, 주제, 광고 수요, 계절, UX 등에 따라 크게 달라지므로 사전에 고정 수익을 가정하지 않습니다.

## 2. 콘텐츠 유형별 수익화 매핑

| 검색 의도 | 콘텐츠 예 | 1차 수익화 | 2차 수익화 |
|---|---|---|---|
| 비교/대안 | n8n vs Make, Tool A alternatives | 제휴 | 비교표 템플릿 |
| 가격/비용 | self-hosted 비용, SaaS 가격 비교 | 제휴 | ROI 계산 템플릿 |
| How-to | Ollama + n8n 구축 | 제휴 | workflow/배포 템플릿 |
| 오픈소스/self-hosted | local LLM, RAG infra | hosting/VPS 제휴 | 설치 kit / 컨설팅 |
| 보안/프라이버시 | local AI security | 컨설팅 리드 | 체크리스트 상품 |
| 신제품/릴리스 | 새 버전 핵심 변화 | 내부링크/구독 | 후속 비교글 |
| 에버그린 문제 해결 | 자동화 실패/운영 방법 | 디지털 상품 | 컨설팅 |

핵심은 **모든 글을 강제로 수익화하지 않는 것**입니다. 정보성 글은 유입과 신뢰 형성 역할을 하고, 상업의도가 높은 글로 내부링크를 연결합니다.

## 3. 콘텐츠 포트폴리오 목표

자동 주제 선정 결과를 장기적으로 다음 비율에 가깝게 유지합니다.

- 35%: 문제 해결 / How-to / 구현
- 25%: 비교 / alternatives / best-for-X
- 15%: 비용 / ROI / hosting / 운영
- 15%: 에버그린 개념 + 실무 의사결정
- 10%: 최신 릴리스 / 트렌드

뉴스 비중이 너무 높으면 글 수명이 짧고, 비교글만 많으면 상업적 사이트처럼 보일 수 있습니다. 장기 검색자산과 구매의도 콘텐츠를 함께 쌓습니다.

## 4. 클러스터 전략

단일 글보다 **주제 클러스터**가 수익화에 유리합니다.

예: `n8n` 클러스터
1. n8n이 적합한 팀 / 적합하지 않은 팀
2. n8n vs Make
3. n8n self-hosted 설치
4. n8n + Ollama 연결
5. n8n 보안 체크리스트
6. n8n 운영비 계산
7. n8n workflow 템플릿 모음

각 글은 관련 글로 내부링크하고, 최종적으로 `도구 선택`, `구축`, `운영`, `템플릿` 페이지로 독자를 이동시킵니다.

우선 구축할 수익성 클러스터 후보:
- n8n / workflow automation
- local LLM / Ollama
- RAG / knowledge automation
- AI coding tools
- self-hosted AI / hosting
- AI agent frameworks

## 5. 90일 실행 계획

### 1~30일: 검색자산과 신뢰 구축
목표:
- 품질 기준을 유지한 핵심 글 20~30개 축적
- 최소 3개 주제 클러스터 형성
- Search Console / GA4 연결
- 승인된 제휴 프로그램만 등록
- 첫 무료 다운로드 자료 1개 준비

광고는 서두르지 않습니다.

### 31~60일: 상업의도 콘텐츠 강화
목표:
- Search Console에서 노출이 발생하는 쿼리 확인
- 순위 4~20위 글 보강
- 비교/가격/대안 글의 실제 제휴 outbound click 측정
- 첫 유료 workflow/template bundle 출시
- 기존 유입 글에서 상품/관련 비교글로 내부링크

### 61~90일: 수익 최적화
목표:
- 글별 `검색유입 → outbound click → conversion → revenue` 기록
- 제휴 클릭은 많지만 전환이 낮은 글의 CTA/독자 의도 재검토
- 전환이 높은 클러스터에 후속 글 투자
- 디지털 상품 landing page 개선
- 콘텐츠/UX가 충분히 성숙하면 AdSense 신청 검토
- 유입이 반복되는 분야에 스폰서십/컨설팅 가능성 테스트

## 6. 측정해야 할 KPI

검색 KPI:
- Google Search impressions
- clicks
- CTR
- average position
- landing page sessions
- 신규/재방문 비율

수익 KPI:
- affiliate outbound clicks
- affiliate conversion rate
- EPC(클릭당 제휴 수익)
- 디지털 상품 landing page conversion
- 문의/리드 수
- 글별 revenue
- 주제 클러스터별 revenue
- Page RPM(광고 활성화 후)

가장 중요한 지표는 단순 PV가 아니라 **글별 30일/90일 수익과 검색 성장률**입니다.

## 7. 다음 주제 선택에 수익 데이터를 반영하는 방식

최종 목표는 현재의 추정 점수에서 실제 성과 데이터 기반 점수로 발전시키는 것입니다.

예시:

`Opportunity = 검색기회 × 콘텐츠적합도 × 상업의도 × 과거 클러스터 성과`

실제 데이터가 쌓이면:
- 노출↑, CTR↓ → 제목/description 개선
- 순위 4~15위 → 내용/내부링크 보강
- affiliate click↑, conversion↑ → 같은 구매의도 클러스터 확장
- traffic↑, revenue↓ → 상업의도 페이지로 내부링크 강화
- revenue/article↑ → 후속 주제 우선순위 상승

현재 자동 주제 선택의 `monetizationFit`은 추정값이므로, Search Console/GA4/제휴 리포트가 연결되면 실제 수익 데이터로 대체하는 것이 다음 핵심 단계입니다.

## 8. 수익 계산은 예측 대신 공식으로 관리

제휴:
`제휴 수익 = qualified outbound clicks × conversion rate × average commission`

디지털 상품:
`상품 수익 = landing page visitors × purchase conversion × net price`

컨설팅:
`서비스 수익 = qualified leads × close rate × average project value`

광고:
`광고 수익 = pageviews / 1000 × actual Page RPM`

각 요소를 실제 데이터로 업데이트합니다. 검색량이나 수익률을 AI가 임의로 만들어내지 않습니다.

## 9. 수익화 안전 원칙

- 제휴 때문에 리뷰/비교 결론을 바꾸지 않습니다.
- 사용하지 않은 제품을 직접 사용해봤다고 표현하지 않습니다.
- 상업적 재사용이 불명확한 이미지는 사용하지 않습니다.
- Wikimedia Commons 사진은 허용 라이선스, 저자, 원본 페이지를 모두 저장하고 노출합니다.
- CC BY-NC, CC BY-ND, CC BY-NC-SA, unknown license는 자동 사용하지 않습니다.
- 광고/제휴가 본문보다 더 눈에 띄게 만들지 않습니다.
- 스크랩/얇은 재작성 대신 실제 비교 기준, 구현 단계, 한계, 운영 리스크를 제공합니다.
- YMYL/불법/위험 주제는 현재 필터를 유지합니다.

## 10. 장기 목표 수익 구조

특정 비율을 보장할 수는 없지만, 기술 블로그의 장기 목표는 광고 의존도를 낮추는 것입니다.

우선순위 예시:
1. 제휴 + 디지털 상품: 핵심
2. 컨설팅/리드: 고단가 보조
3. 스폰서십: 트래픽/브랜드가 생긴 뒤
4. AdSense: 안정적 보조 수익

블로그의 가장 중요한 자산은 자동 생성 글 수가 아니라 **검색 의도를 충족하는 검증된 콘텐츠 + 성과 데이터 + 반복 사용 가능한 도구/템플릿**입니다.
