import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let assistants = {
  brand_awareness: null,
  brand_awareness_report: null
};

export async function listAllAssistants() {
  try {
    const assistantList = await openai.beta.assistants.list({
      limit: 100
    });
    return assistantList.data;
  } catch (error) {
    console.error('Error listing assistants:', error);
    return [];
  }
}

export async function findAssistantByName(name) {
  const allAssistants = await listAllAssistants();
  return allAssistants.find(a => a.name === name);
}

export async function initializeAssistants() {
  console.log('Initializing OpenAI assistants...');

  // List all existing assistants
  const allAssistants = await listAllAssistants();
  console.log(`Found ${allAssistants.length} existing assistant(s) in your account`);
  
  if (allAssistants.length > 20) {
    console.warn(`⚠️  Warning: You have ${allAssistants.length} assistants. Consider cleaning up old ones.`);
  }

  // Load assistant configurations
  const assistantConfig = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../config/assistants/brand_awareness_assistant.json'),
      'utf-8'
    )
  );

  const reportConfig = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../config/report_generators/brand_awareness_report.json'),
      'utf-8'
    )
  );

  // Try to find existing conversation assistant by name
  let conversationAssistant = await findAssistantByName(assistantConfig.name);
  
  if (conversationAssistant) {
    console.log(`✓ Reusing existing Brand Awareness Assistant: ${conversationAssistant.id}`);
    assistants.brand_awareness = conversationAssistant.id;
  } else {
    // Create new conversation assistant
    conversationAssistant = await openai.beta.assistants.create({
      name: assistantConfig.name,
      instructions: assistantConfig.system_prompt_template, // Will be customized per session
      model: 'gpt-4o',
      tools: []
    });
    assistants.brand_awareness = conversationAssistant.id;
    console.log(`✓ Created new Brand Awareness Assistant: ${conversationAssistant.id}`);
  }

  // Try to find existing report generator assistant by name
  let reportAssistant = await findAssistantByName(reportConfig.name);
  
  if (reportAssistant) {
    console.log(`✓ Reusing existing Brand Awareness Report Generator: ${reportAssistant.id}`);
    assistants.brand_awareness_report = reportAssistant.id;
  } else {
    // Create new report generator assistant
    reportAssistant = await openai.beta.assistants.create({
      name: reportConfig.name,
      instructions: reportConfig.system_prompt,
      model: 'gpt-4o',
      tools: []
    });
    assistants.brand_awareness_report = reportAssistant.id;
    console.log(`✓ Created new Brand Awareness Report Generator: ${reportAssistant.id}`);
  }

  // Update .env file with assistant IDs (optional, for reference)
  try {
    const envPath = path.join(__dirname, '../../.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    
    if (!envContent.includes('BRAND_AWARENESS_ASSISTANT_ID')) {
      envContent += `\nBRAND_AWARENESS_ASSISTANT_ID=${conversationAssistant.id}`;
    } else {
      envContent = envContent.replace(
        /BRAND_AWARENESS_ASSISTANT_ID=.*/,
        `BRAND_AWARENESS_ASSISTANT_ID=${conversationAssistant.id}`
      );
    }

    if (!envContent.includes('BRAND_AWARENESS_REPORT_GENERATOR_ID')) {
      envContent += `\nBRAND_AWARENESS_REPORT_GENERATOR_ID=${reportAssistant.id}`;
    } else {
      envContent = envContent.replace(
        /BRAND_AWARENESS_REPORT_GENERATOR_ID=.*/,
        `BRAND_AWARENESS_REPORT_GENERATOR_ID=${reportAssistant.id}`
      );
    }

    fs.writeFileSync(envPath, envContent);
  } catch (error) {
    console.warn('Could not update .env file with assistant IDs:', error.message);
  }

  return assistants;
}

export function getAssistantId(type) {
  if (type === 'conversation' || type === 'brand_awareness') {
    return assistants.brand_awareness;
  }
  if (type === 'report' || type === 'brand_awareness_report') {
    return assistants.brand_awareness_report;
  }
  return null;
}

export async function createThread() {
  const thread = await openai.beta.threads.create();
  return thread.id;
}

export async function sendMessage(threadId, assistantId, message, systemPromptOverride = null) {
  // Add user message to thread
  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: message
  });

  // If we need to override the system prompt, we'll need to update the assistant
  // For now, we'll use the assistant as-is and include context in the message
  let runParams = {
    assistant_id: assistantId
  };

  // Create and run
  const run = await openai.beta.threads.runs.create(threadId, runParams);

  // Wait for completion
  await waitForRunCompletion(threadId, run.id);

  // Retrieve the assistant's response
  const messages = await openai.beta.threads.messages.list(threadId);
  const assistantMessage = messages.data[0];

  if (assistantMessage.role === 'assistant' && assistantMessage.content[0].type === 'text') {
    return assistantMessage.content[0].text.value;
  }

  throw new Error('No valid response from assistant');
}

export async function waitForRunCompletion(threadId, runId, maxWaitTime = 60000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);

    if (run.status === 'completed') {
      return run;
    }

    if (run.status === 'failed') {
      throw new Error(`Run failed: ${run.last_error?.message || 'Unknown error'}`);
    }

    if (run.status === 'cancelled' || run.status === 'expired') {
      throw new Error(`Run ${run.status}`);
    }

    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Run timeout');
}

export async function extractStructuredData(conversationHistory, assistantConfig) {
  // Build extraction prompt
  const questions = assistantConfig.questions.map(q => ({
    id: q.id,
    question: q.question_template,
    type: q.type
  }));

  const extractionPrompt = `You are extracting structured data from a conversation between Zansei (a marketing assistant) and a business owner.

The conversation history:
${JSON.stringify(conversationHistory, null, 2)}

Required questions to extract answers for:
${JSON.stringify(questions, null, 2)}

Extract the answers from the conversation. For each question:
- If the answer is present, extract the raw_answer and provide a normalized_value
- If the answer is not present, set normalized_value to null
- For select questions, normalize to the option value
- For text/textarea questions, keep the meaningful content

Output as JSON with this structure:
{
  "budget": { "raw_answer": "...", "normalized_value": "..." },
  "target_customer": { "raw_answer": "...", "normalized_value": "..." },
  ...
}

Only include questions that have answers.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a data extraction assistant. Extract structured data from conversations accurately.'
      },
      {
        role: 'user',
        content: extractionPrompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error parsing extracted data:', error);
    return {};
  }
}

export async function generateReportWithAssistant(assistantId, reportRequest) {
  const thread = await createThread();

  // Send the report request as a message
  const requestMessage = `Generate a Brand Awareness Strategy Report based on this data:

${JSON.stringify(reportRequest, null, 2)}

Please generate a comprehensive report in JSON format matching this structure:
{
  "executive_summary": "...",
  "components": [
    {
      "id": "content_strategy",
      "title": "📝 Content Strategy",
      "sections": [...]
    },
    ...
  ],
  "timeline": {
    "weeks": [...]
  }
}

Make sure the report is highly specific to their business context, actionable, and budget-realistic.`;

  await openai.beta.threads.messages.create(thread, {
    role: 'user',
    content: requestMessage
  });

  const run = await openai.beta.threads.runs.create(thread, {
    assistant_id: assistantId
  });

  await waitForRunCompletion(thread, run.id);

  // Get the response
  const messages = await openai.beta.threads.messages.list(thread);
  const assistantMessage = messages.data[0];

  if (assistantMessage.role === 'assistant' && assistantMessage.content[0].type === 'text') {
    const responseText = assistantMessage.content[0].text.value;
    
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (error) {
        console.error('Error parsing report JSON:', error);
      }
    }

    // If no JSON found, try to parse the whole response
    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Could not parse report as JSON:', error);
      // Return a fallback structure
      return {
        executive_summary: responseText.substring(0, 500),
        components: [],
        error: 'Could not parse report as structured JSON'
      };
    }
  }

  throw new Error('No valid report response from assistant');
}

export async function cleanupOldAssistants(keepNames = []) {
  const allAssistants = await listAllAssistants();
  const keepNamesSet = new Set(keepNames);
  
  let deleted = 0;
  for (const assistant of allAssistants) {
    if (!keepNamesSet.has(assistant.name)) {
      try {
        await openai.beta.assistants.del(assistant.id);
        console.log(`Deleted old assistant: ${assistant.name} (${assistant.id})`);
        deleted++;
      } catch (error) {
        console.warn(`Could not delete assistant ${assistant.id}:`, error.message);
      }
    }
  }
  
  console.log(`Cleaned up ${deleted} old assistant(s)`);
  return deleted;
}

