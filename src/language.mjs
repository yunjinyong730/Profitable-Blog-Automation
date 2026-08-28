export const KOREAN_FIRST_SYSTEM_RULES = `Korean-first publication language policy:
- All reader-facing prose and metadata must be primarily natural Korean, including article/topic titles, descriptions, categories, general-purpose tags, reader problems/outcomes, section headings, body paragraphs, FAQ text, and editorial summaries.
- Keep proper product/brand/model names, API names, code identifiers, commands, URLs, and technical tokens in their established original spelling when useful (for example ChatGPT, Claude, GitHub Copilot, n8n, RAG, API).
- Source titles may remain in their original language. slug and URL fields must not be translated. photoSearchQuery may remain English because it is used for Wikimedia Commons search.
- A Korean-first title may contain English brand terms, but it must not be an English sentence with only token Korean decoration.
- Prefer Korean equivalents for generic concepts when they are clear and natural; do not awkwardly transliterate ordinary English prose.`;

const count = (value, pattern) => (String(value || '').match(pattern) || []).length;

export function koreanTextStats(value) {
  const text = String(value || '');
  const hangul = count(text, /[가-힣]/g);
  const latin = count(text, /[A-Za-z]/g);
  const letters = hangul + latin;
  return {
    hangul,
    latin,
    share: letters ? hangul / letters : 0
  };
}

function checkText(issues, label, value, { minHangul, minShare }) {
  const stats = koreanTextStats(value);
  if (stats.hangul < minHangul || stats.share < minShare) {
    issues.push(`${label} (한글 ${stats.hangul}자, 한글 비중 ${Math.round(stats.share * 100)}%)`);
  }
}

function joinSections(sections, field) {
  return (sections || []).flatMap((section) => {
    if (field === 'heading') return [section?.heading || ''];
    return section?.[field] || [];
  }).join(' ');
}

function joinFaq(items) {
  return (items || []).flatMap((item) => [item?.question || '', item?.answer || '']).join(' ');
}

function articleIssues(data, prefix = 'article') {
  const issues = [];
  checkText(issues, `${prefix}.title`, data.title, { minHangul: 3, minShare: 0.20 });
  checkText(issues, `${prefix}.description`, data.description, { minHangul: 12, minShare: 0.40 });
  checkText(issues, `${prefix}.category`, data.category, { minHangul: 2, minShare: 0.35 });
  checkText(issues, `${prefix}.tags`, (data.tags || []).join(' '), { minHangul: 2, minShare: 0.15 });
  checkText(issues, `${prefix}.sectionHeadings`, joinSections(data.sections, 'heading'), { minHangul: 6, minShare: 0.25 });
  checkText(issues, `${prefix}.body`, joinSections(data.sections, 'paragraphs'), { minHangul: 80, minShare: 0.45 });
  checkText(issues, `${prefix}.faq`, joinFaq(data.faq), { minHangul: 20, minShare: 0.40 });
  return issues;
}

function qaIssues(data) {
  const issues = [];
  checkText(issues, 'qa.revisedTitle', data.revisedTitle, { minHangul: 3, minShare: 0.20 });
  checkText(issues, 'qa.revisedDescription', data.revisedDescription, { minHangul: 12, minShare: 0.40 });
  checkText(issues, 'qa.sectionHeadings', joinSections(data.revisedSections, 'heading'), { minHangul: 6, minShare: 0.25 });
  checkText(issues, 'qa.body', joinSections(data.revisedSections, 'paragraphs'), { minHangul: 80, minShare: 0.45 });
  checkText(issues, 'qa.faq', joinFaq(data.revisedFaq), { minHangul: 20, minShare: 0.40 });
  if (data.verificationSummary != null) {
    checkText(issues, 'qa.verificationSummary', data.verificationSummary, { minHangul: 8, minShare: 0.35 });
  }
  return issues;
}

function topicIssues(data) {
  const issues = [];
  for (const [index, candidate] of (data.candidates || []).entries()) {
    checkText(issues, `topic.candidates[${index}].topic`, candidate.topic, { minHangul: 3, minShare: 0.18 });
    checkText(issues, `topic.candidates[${index}].readerProblem`, candidate.readerProblem, { minHangul: 5, minShare: 0.30 });
    checkText(issues, `topic.candidates[${index}].expectedOutcome`, candidate.expectedOutcome, { minHangul: 5, minShare: 0.30 });
  }
  return issues;
}

export function koreanLanguageIssues(schema, data) {
  const properties = schema?.properties || {};
  if (properties.candidates) return topicIssues(data);
  if (properties.revisedTitle && properties.revisedDescription && properties.revisedSections) return qaIssues(data);
  if (properties.title && properties.description && properties.category && properties.sections) return articleIssues(data);
  return [];
}

export function koreanRepairInstruction(issues) {
  return `한국어 우선 언어 정책을 통과하지 못했습니다. 다음 항목을 교정하세요: ${issues.join('; ')}.\n\n완전한 JSON 객체를 다시 반환하세요. 독자가 보는 제목, 설명, 카테고리, 일반 태그, 문제/결과 설명, 섹션 제목, 본문, FAQ와 편집 요약은 자연스러운 한국어가 중심이어야 합니다. ChatGPT, Claude, GitHub Copilot, n8n, RAG, API 같은 고유 제품명·모델명·기술 식별자는 원래 표기를 유지해도 됩니다. slug, URL, 코드, 명령어, 원문 source title, photoSearchQuery는 억지로 번역하지 마세요. 기존 사실관계와 결론을 바꾸거나 새 사실·수치·URL·사례를 만들지 마세요. 영어 문장을 단순 음역하지 말고 한국 독자가 자연스럽게 읽을 수 있게 표현하세요.`;
}
