/**
 * Dynamic JSON Schema Builder for AI-Native Data Extraction
 * 
 * Generates JSON schemas from assistant configs to enable structured outputs
 * that are flexible and maintainable without hardcoded logic.
 */

/**
 * Builds a JSON schema for structured data extraction from conversation
 * @param {Object} assistantConfig - The assistant configuration with questions
 * @returns {Object} JSON schema compatible with OpenAI's structured outputs
 */
export function buildExtractionSchema(assistantConfig) {
  const properties = {};
  const required = [];

  // Process each question in the config
  for (const question of assistantConfig.questions || []) {
    if (!question.id) continue;

    // Build the schema for this question's extracted data
    const questionSchema = {
      type: 'object',
      properties: {
        raw_answer: {
          type: 'string',
          description: `The exact text or phrase from the conversation that answers or implies: ${question.question_template || question.id}. Can be explicit answer, past behavior, conditional statement, or inferred context.`
        },
        normalized_value: {
          type: ['string', 'number', 'null'],
          description: buildNormalizationDescription(question)
        },
        confidence: {
          type: 'number',
          enum: [0.0, 0.25, 0.5, 0.75, 1.0],
          description: 'Confidence level: 0.0=not mentioned anywhere, 0.25=weakly implied, 0.5=partially clear or inferred, 0.75=clearly implied/inferred from context/past behavior, 1.0=explicitly stated. Be permissive - if you can reasonably infer an answer, use 0.5-0.75 confidence.'
        },
        extracted_context: {
          type: 'object',
          description: 'Additional context extracted (e.g., timeline, constraints, emotional state)',
          properties: {
            timeline: { type: 'string' },
            constraints: { type: 'string' },
            emotional_state: { type: 'string' },
            related_info: { type: 'string' }
          },
          additionalProperties: true
        }
      },
      required: ['raw_answer', 'normalized_value', 'confidence']
    };

    // Add question-specific guidance in description
    if (question.type === 'select' && question.options) {
      questionSchema.properties.normalized_value.description += `\n\nAvailable options:\n${JSON.stringify(question.options, null, 2)}\n\nMatch intelligently - if user says "around 1k" and there's a "$1,000-3,000" option, use that option's value. If user says "not really" and there's a "None really" option, match that.`;
      
      // Special guidance for budget questions
      if (question.id === 'budget' || question.id.includes('budget')) {
        questionSchema.properties.normalized_value.description += `\n\n**BUDGET INFERENCE**: If user mentions past spending (e.g., "I spent $300-500"), extract this as their budget by matching to the closest option range. Past spending indicates budget capacity. Use confidence 0.75 for inferred budgets from past spending.`;
      }
    }

    if (question.placeholder) {
      questionSchema.properties.normalized_value.description += `\n\nExample format: ${question.placeholder}`;
    }

    properties[question.id] = questionSchema;
    
    // Mark required questions as required in schema
    if (question.required) {
      required.push(question.id);
    }
  }

  // Add user_name extraction (always include this)
  properties.user_name = {
    type: 'object',
    properties: {
      raw_answer: {
        type: 'string',
        description: 'The exact text where the user mentions their name'
      },
      normalized_value: {
        type: ['string', 'null'],
        description: 'The extracted name, normalized (first name only, or full name if provided). Extract from phrases like "I\'m Maria", "call me Walter", "my name is...", etc.'
      },
      confidence: {
        type: 'number',
        enum: [0.0, 0.25, 0.5, 0.75, 1.0],
        description: 'Confidence in name extraction'
      }
    },
    required: ['raw_answer', 'normalized_value', 'confidence']
  };

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: false
  };
}

/**
 * Builds normalization description for a question based on its type
 */
function buildNormalizationDescription(question) {
  let description = `Normalized value for: ${question.question_template || question.id}`;

  // Add inference guidance for budget questions
  if (question.id === 'budget' || question.id.includes('budget')) {
    description += '\n\n**CRITICAL: Budget Inference**';
    description += '\n- If user mentions past spending (e.g., "I spent $300-500"), infer this as their current budget range with confidence 0.75';
    description += '\n- If user says "I would spend X if..." or "I am open to spending X", extract that as budget with confidence 0.75';
    description += '\n- Past spending is relevant context - use it to infer current budget capacity';
    description += '\n- Match to the closest option range (e.g., "$300-500" → "$500-1,000" if that is the closest match)';
  }

  switch (question.type) {
    case 'select':
      description += '\n\nFor select questions: Match the user\'s answer intelligently to one of the available options.';
      description += '\n- If user says "around 1k" and option is "$1,000-3,000", use "$1,000-3,000"';
      description += '\n- If user says "not really" and option is "None really", use "None really"';
      description += '\n- Use the option\'s value field if present, otherwise use the label';
      description += '\n- If no good match, use the closest option or return the user\'s answer as-is';
      description += '\n- **INFERENCE ALLOWED**: If the answer is implied or can be inferred from context, extract it with appropriate confidence (0.5-0.75)';
      break;

    case 'select_multiple':
      description += '\n\nFor multi-select: Return an array of matched option values.';
      description += '\n- Extract all mentioned options intelligently';
      description += '\n- Return empty array if none selected';
      break;

    case 'textarea':
    case 'text':
      description += '\n\nFor text questions: Keep the meaningful content, remove filler words.';
      description += '\n- Preserve key details, numbers, names, locations';
      description += '\n- Remove conversational filler ("um", "like", "you know")';
      description += '\n- Keep emotional context if relevant (e.g., "frustrated", "excited")';
      break;

    default:
      description += '\n\nExtract and normalize based on the question type and context.';
  }

  return description;
}

/**
 * Builds the system prompt for the extraction assistant
 * @param {Object} assistantConfig - The assistant configuration
 * @returns {string} System prompt for intelligent extraction
 */
export function buildExtractionSystemPrompt(assistantConfig) {
  return `You are an expert at extracting structured data from natural conversations.

Your task is to extract answers to marketing questions from a conversation between Zansei (a marketing assistant) and a business owner.

**Key Principles:**
1. **Understand Intent**: Don't just match words - understand what the user means
2. **Intelligent Inference**: Extract answers even when not explicitly stated
   - Past spending → infer current budget capacity (confidence 0.75)
   - "I would do X if..." → extract as answer (confidence 0.75)
   - Implied information is valid - extract it with appropriate confidence
3. **Intelligent Normalization**: 
   - "1k" or "one thousand" → "$1,000" or appropriate range
   - "I spent $300-500" → extract as budget "$500-1,000" (closest match) with confidence 0.75
   - "not really" → match to "None really" option if available
   - "families with kids" → extract as detailed description, not just "families"
4. **Extract Context**: Capture implicit information (timeline, constraints, emotions)
5. **Confidence Scoring**: Be honest but permissive about confidence:
   - 1.0 = Explicitly stated and clear
   - 0.75 = Clearly implied, inferred from context, or past behavior that's relevant
   - 0.5 = Partially mentioned or can be reasonably inferred
   - 0.25 = Weakly implied but extractable
   - 0.0 = Not mentioned at all
6. **Nuance Matters**: Preserve specific details that show you understand their unique situation

**Question Context:**
${JSON.stringify(assistantConfig.questions.map(q => ({
  id: q.id,
  question: q.question_template,
  type: q.type,
  options: q.options || null,
  why_matters: q.why_matters || null
})), null, 2)}

**Extraction Guidelines:**
- **INFERENCE IS ENCOURAGED**: Extract answers even when not explicitly asked
- **Past behavior is relevant**: If user mentions past spending, extract as current budget capacity
- **Conditional statements are answers**: "I would spend X if..." is a valid budget answer
- For select questions: Match intelligently, not just exact text. Infer from context.
- For text questions: Preserve meaningful details and context
- Extract user_name from first message if present
- Set confidence based on how explicit the answer is, but be permissive with inference:
  - Past spending mentioned → extract as budget with 0.75 confidence
  - Conditional statement → extract with 0.75 confidence
  - Clearly implied → extract with 0.75-1.0 confidence
- Include extracted_context for timeline, constraints, emotional state when relevant
- **Only set confidence to 0.0 if the answer is truly not mentioned anywhere in the conversation**

**Special Cases:**
- **Budget questions**: If user mentions "I spent $X" or "I would spend $X", extract this as budget even if it's past spending or conditional. Match to closest option range.
- **Timeline questions**: If user mentions "I want to start in December" or "by January", extract as launch_date even if not asked directly.
- **Target audience**: If user describes their customers in detail, extract as both target_customer AND launch_target_audience if relevant.

**Output Format:**
Return a JSON object matching the provided schema. Include ALL questions where you can find ANY answer (confidence > 0.0), including inferred answers.`;
}

