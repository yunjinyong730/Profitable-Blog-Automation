import {
  ensureModel,
  removeModel,
  structuredResponse as baseStructuredResponse
} from './ollama-base.mjs';

export { ensureModel, removeModel };

const DRAFT_HANDOFF_WARN_PARAGRAPH_CHARS = 1000;
const DRAFT_HANDOFF_TARGET_PARAGRAPH_CHARS = 2200;
const QA_PRIMARY_TARGET_PARAGRAPH_CHARS = 3800;

function paragraphChars(sections) {
  return (sections || []).flatMap((section) => section?.paragraphs || []).join('').length;
}

function isDraftSchema(schema) {
  const properties = schema?.properties || {};
  return Boolean(properties.sections && properties.title && properties.slug && !properties.revisedSections);
}

function isQaSchema(schema) {
  const properties = schema?.properties || {};
  return Boolean(properties.revisedSections && properties.revisedTitle && properties.revisedDescription);
}

function draftHandoffSchema(schema) {
  const properties = { ...(schema?.properties || {}) };
  delete properties.slug;
  return {
    ...schema,
    properties,
    required: (schema?.required || []).filter((field) => field !== 'slug')
  };
}

export async function structuredResponse(args) {
  if (isDraftSchema(args.schema)) {
    const result = await baseStructuredResponse({
      ...args,
      schema: draftHandoffSchema(args.schema),
      instructions: `${args.instructions}\n\nDraft handoff policy: This is the evidence-grounded working draft, not the final published article. Build a complete 5-9 section structure and aim for about ${DRAFT_HANDOFF_TARGET_PARAGRAPH_CHARS} Korean paragraph characters total, normally with 2-3 substantive paragraphs in important sections. Prioritize supported reasoning, decision criteria, actionable steps, limitations, and trade-offs over filler. Do not spend another generation merely padding the draft: the independent QA stage owns the final 3500+ character publication requirement. A short but structurally valid draft must still be handed to QA rather than discarded solely for length.`
    });
    const chars = paragraphChars(result.data.sections);
    if (chars < DRAFT_HANDOFF_WARN_PARAGRAPH_CHARS) {
      console.warn(`[quality] draft handoff depth=${chars} paragraph chars is below the ${DRAFT_HANDOFF_WARN_PARAGRAPH_CHARS}-char advisory target; accepting the structurally valid draft and delegating final depth to QA (hard final minimum remains 3500).`);
    } else {
      console.log(`[quality] draft handoff depth=${chars} paragraph chars; final QA minimum remains 3500.`);
    }
    return {
      ...result,
      data: { ...result.data, slug: '' }
    };
  }

  if (isQaSchema(args.schema)) {
    return baseStructuredResponse({
      ...args,
      maxOutputTokens: Math.max(Number(args.maxOutputTokens) || 0, 4000),
      instructions: `${args.instructions}\n\nFinal publication depth policy: revisedSections is the final reader-facing article, not a summary of the draft. Preserve factual discipline while expanding supported explanations, concrete decision criteria, implementation steps, caveats, and trade-offs so the revised section paragraphs target at least ${QA_PRIMARY_TARGET_PARAGRAPH_CHARS} Korean characters in the primary QA response. The hard publication minimum remains 3500 paragraph characters and must never be bypassed with filler or unsupported claims. If the incoming draft is short, reconstruct sufficient depth from the supplied research and public evidence rather than rejecting it merely for being brief.`
    });
  }

  return baseStructuredResponse(args);
}
