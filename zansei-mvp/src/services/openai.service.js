import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildExtractionSchema, buildExtractionSystemPrompt } from '../utils/schemaBuilder.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let assistants = {
  customer_acquisition: null,
  customer_acquisition_report: null,
  brand_awareness: null,
  brand_awareness_report: null,
  customer_retention: null,
  customer_retention_report: null,
  product_launch: null,
  product_launch_report: null,
  competitive_strategy: null,
  competitive_strategy_report: null,
  innovation: null,
  innovation_report: null
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
  
  if (allAssistants.length > 30) {
    console.warn(`⚠️  Warning: You have ${allAssistants.length} assistants. Consider cleaning up old ones.`);
  }

  // Load funnels config to get all funnel IDs
  const funnelsConfig = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../config/funnels.json'),
      'utf-8'
    )
  );

  const funnelIds = funnelsConfig.funnels.map(f => f.id);

  // Initialize all conversation assistants and report generators
  for (const funnelId of funnelIds) {
    try {
      // Load conversation assistant config
      const assistantConfigPath = path.join(
        __dirname,
        `../../config/assistants/${funnelId}_assistant.json`
      );
      
      if (!fs.existsSync(assistantConfigPath)) {
        console.warn(`⚠️  Assistant config not found for funnel: ${funnelId}`);
        continue;
      }

      const assistantConfig = JSON.parse(fs.readFileSync(assistantConfigPath, 'utf-8'));

      // Try to find existing conversation assistant by name
      let conversationAssistant = await findAssistantByName(assistantConfig.name);
      
      if (conversationAssistant) {
        // Check if instructions need updating (compare with current config)
        const currentInstructions = conversationAssistant.instructions || '';
        const newInstructions = assistantConfig.system_prompt_template;
        
        // Update if instructions have changed (simple comparison - could be improved)
        if (currentInstructions !== newInstructions) {
          console.log(`🔄 Updating instructions for ${assistantConfig.name}...`);
          conversationAssistant = await openai.beta.assistants.update(conversationAssistant.id, {
            instructions: newInstructions
          });
          console.log(`✓ Updated ${assistantConfig.name}: ${conversationAssistant.id}`);
        } else {
          console.log(`✓ Reusing existing ${assistantConfig.name}: ${conversationAssistant.id}`);
        }
        assistants[funnelId] = conversationAssistant.id;
      } else {
        // Create new conversation assistant
        conversationAssistant = await openai.beta.assistants.create({
          name: assistantConfig.name,
          instructions: assistantConfig.system_prompt_template, // Will be customized per session
          model: 'gpt-4o',
          tools: []
        });
        assistants[funnelId] = conversationAssistant.id;
        console.log(`✓ Created new ${assistantConfig.name}: ${conversationAssistant.id}`);
      }

      // Load report generator config
      const reportConfigPath = path.join(
        __dirname,
        `../../config/report_generators/${funnelId}_report.json`
      );
      
      if (!fs.existsSync(reportConfigPath)) {
        console.warn(`⚠️  Report generator config not found for funnel: ${funnelId}`);
        continue;
      }

      const reportConfig = JSON.parse(fs.readFileSync(reportConfigPath, 'utf-8'));

      // Try to find existing report generator by name
      let reportAssistant = await findAssistantByName(reportConfig.name);
      
      if (reportAssistant) {
        // Check if instructions need updating
        const currentInstructions = reportAssistant.instructions || '';
        const newInstructions = reportConfig.system_prompt;
        
        // Update if instructions have changed
        if (currentInstructions !== newInstructions) {
          console.log(`🔄 Updating instructions for ${reportConfig.name}...`);
          reportAssistant = await openai.beta.assistants.update(reportAssistant.id, {
            instructions: newInstructions
          });
          console.log(`✓ Updated ${reportConfig.name}: ${reportAssistant.id}`);
        } else {
          console.log(`✓ Reusing existing ${reportConfig.name}: ${reportAssistant.id}`);
        }
        assistants[`${funnelId}_report`] = reportAssistant.id;
      } else {
        // Create new report generator assistant
        reportAssistant = await openai.beta.assistants.create({
          name: reportConfig.name,
          instructions: reportConfig.system_prompt,
          model: 'gpt-4o',
          tools: []
        });
        assistants[`${funnelId}_report`] = reportAssistant.id;
        console.log(`✓ Created new ${reportConfig.name}: ${reportAssistant.id}`);
      }
    } catch (error) {
      console.error(`❌ Error initializing assistants for funnel ${funnelId}:`, error.message);
    }
  }

  console.log(`\n✅ Initialized ${Object.keys(assistants).length} assistant(s) total\n`);

  return assistants;
}

export function getAssistantId(funnelId, type = 'conversation') {
  // If type is 'report', append '_report' to the key
  const key = type === 'report' ? `${funnelId}_report` : funnelId;
  return assistants[key] || null;
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

  // If system prompt override is provided, update the assistant temporarily
  // Note: This updates the assistant globally, so we'll revert it after if needed
  let originalInstructions = null;
  if (systemPromptOverride) {
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    originalInstructions = assistant.instructions;
    await openai.beta.assistants.update(assistantId, {
      instructions: systemPromptOverride
    });
  }

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

  // Restore original instructions if we updated them
  if (systemPromptOverride && originalInstructions) {
    await openai.beta.assistants.update(assistantId, {
      instructions: originalInstructions
    });
  }

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

export async function getThreadMessages(threadId) {
  const messages = await openai.beta.threads.messages.list(threadId);
  return messages.data.map(msg => {
    if (msg.role === 'assistant' && msg.content[0]?.type === 'text') {
      return msg.content[0].text.value;
    }
    return '';
  }).filter(m => m);
}

export async function getAssistantResponse(threadId, assistantId) {
  const messages = await openai.beta.threads.messages.list(threadId);
  const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
  
  if (assistantMessage && assistantMessage.content[0]?.type === 'text') {
    return assistantMessage.content[0].text.value;
  }
  
  throw new Error('No valid response from assistant');
}

export async function extractStructuredData(conversationHistory, assistantConfig) {
  // Build dynamic JSON schema from assistant config
  const extractionSchema = buildExtractionSchema(assistantConfig);
  const systemPrompt = buildExtractionSystemPrompt(assistantConfig);

  // Build user prompt with conversation history
  const extractionPrompt = `Extract structured data from this conversation between Zansei (a marketing assistant) and a business owner.

**Conversation History:**
${JSON.stringify(conversationHistory, null, 2)}

**CRITICAL INSTRUCTIONS - BE PERMISSIVE WITH INFERENCE:**

Extract answers for ALL questions that are mentioned, implied, inferred, or can be reasonably deduced from the conversation.

**INFERENCE RULES:**
1. **Past behavior informs current state**: If user says "I spent $300-500 on ads", extract this as budget with confidence 0.75 (past spending indicates budget capacity)
2. **Conditional statements are answers**: "I would spend X if..." → extract as answer with confidence 0.75
3. **Contextual inference**: If user describes their situation, extract relevant answers even if not asked directly
4. **Be generous with confidence**: If you can reasonably infer an answer, extract it with 0.5-0.75 confidence

**SPECIFIC EXTRACTION GUIDELINES:**

**Budget Questions:**
- If user mentions past spending: "I spent $300-500" → extract as budget "$500-1,000" (closest match) with confidence 0.75
- If user says "I would spend X if effective" → extract as budget with confidence 0.75
- Past spending is relevant context for current budget capacity

**Timeline Questions:**
- "I want to start in December" → extract as launch_date with confidence 1.0
- "By January I hope to have clients" → extract as launch_date with confidence 0.75

**Target Audience:**
- If user describes customers in detail, extract as both target_customer AND launch_target_audience if the description fits both

**General:**
- Extract user_name from first message if present
- Use intelligent matching for select questions (e.g., "around 1k" matches "$1,000-3,000" option)
- Preserve nuance and context in text answers
- Set confidence scores permissively:
  * 1.0 = Explicitly stated and clear
  * 0.75 = Clearly implied, inferred from context, or past behavior that's relevant
  * 0.5 = Partially mentioned or can be reasonably inferred
  * 0.25 = Weakly implied but extractable
  * 0.0 = Truly not mentioned anywhere
- Include extracted_context when relevant (timeline, constraints, emotional state)

**Question Context:**
The questions you need to extract answers for are:
${assistantConfig.questions.map(q => `- ${q.id}: ${q.question_template}`).join('\n')}

**Remember**: It's better to extract an answer with 0.75 confidence than to miss it entirely. Past spending, conditional statements, and implied information are all valid answers.

Return a JSON object matching the provided schema. Include ALL questions where you can find ANY answer (confidence > 0.0), including inferred answers.`;

  try {
    const response = await openai.beta.chat.completions.parse({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: extractionPrompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'extracted_data',
          strict: false, // Allow flexibility for schema evolution
          schema: extractionSchema
        }
      },
      temperature: 0.3
    });

    // Parse the structured response
    const parsed = response.choices[0].message.parsed;
    
    console.log(`[DEBUG] OpenAI extraction parsed response:`, JSON.stringify(parsed, null, 2));
    
    // Ensure all question IDs are present (even if null) for consistency
    const result = {};
    for (const question of assistantConfig.questions || []) {
      if (question.id && parsed[question.id]) {
        // Include if confidence > 0 AND normalized_value is not null
        // This ensures we only save actual answers, not empty extractions
        if (parsed[question.id].confidence > 0 && 
            parsed[question.id].normalized_value !== null && 
            parsed[question.id].normalized_value !== undefined) {
          result[question.id] = parsed[question.id];
        } else {
          console.log(`[DEBUG] Filtered out ${question.id}: confidence=${parsed[question.id].confidence}, normalized_value=${parsed[question.id].normalized_value}`);
        }
      } else {
        console.log(`[DEBUG] Question ${question.id} not found in parsed response`);
      }
    }
    
    // Include user_name if extracted (with confidence > 0)
    if (parsed.user_name && parsed.user_name.normalized_value && parsed.user_name.confidence > 0) {
      result.user_name = parsed.user_name;
    }

    console.log(`[DEBUG] Final extracted result (after filtering):`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error extracting structured data:', error);
    // Fallback: try with regular JSON object format if structured outputs fail
    try {
      const fallbackResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: extractionPrompt + '\n\nReturn as JSON object with question IDs as keys.'
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });
      
      const parsed = JSON.parse(fallbackResponse.choices[0].message.content);
      return parsed;
    } catch (fallbackError) {
      console.error('Fallback extraction also failed:', fallbackError);
      return {};
    }
  }
}

export async function generateReportWithAssistant(assistantId, reportRequest) {
  const thread = await createThread();

  // Send the report request as a message
  const requestMessage = `Generate a Brand Awareness Strategy Report based on this data:

${JSON.stringify(reportRequest, null, 2)}

Please generate a comprehensive report in RAW JSON format (no markdown code blocks, no code formatting, just the JSON object) matching this structure:
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

CRITICAL: Output ONLY the JSON object, no markdown formatting, no code blocks, no explanations before or after. Start with { and end with }.

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
    let responseText = assistantMessage.content[0].text.value;
    
    // Strip markdown code blocks if present
    responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    
    // Try to extract JSON from the response (look for first { to last })
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[DEBUG] Successfully parsed report JSON');
        return parsed;
      } catch (error) {
        console.error('[ERROR] Error parsing report JSON:', error);
        console.error('[ERROR] JSON snippet:', jsonMatch[0].substring(0, 200));
        // Try to fix common JSON issues
        let cleanedJson = jsonMatch[0];
        // Remove trailing commas
        cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');
        try {
          return JSON.parse(cleanedJson);
        } catch (e2) {
          console.error('[ERROR] Could not fix JSON:', e2);
        }
      }
    }

    // If no JSON found, try to parse the whole response
    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error('[ERROR] Could not parse report as JSON:', error);
      console.error('[ERROR] Response text (first 500 chars):', responseText.substring(0, 500));
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

export async function forceUpdateAllAssistants() {
  console.log('Force updating all assistants with latest configs...');
  
  // Load funnels config
  const funnelsConfig = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../config/funnels.json'),
      'utf-8'
    )
  );

  const funnelIds = funnelsConfig.funnels.map(f => f.id);
  let updated = 0;

  for (const funnelId of funnelIds) {
    try {
      // Update conversation assistant
      const assistantConfigPath = path.join(
        __dirname,
        `../../config/assistants/${funnelId}_assistant.json`
      );
      
      if (fs.existsSync(assistantConfigPath)) {
        const assistantConfig = JSON.parse(fs.readFileSync(assistantConfigPath, 'utf-8'));
        const existingAssistant = await findAssistantByName(assistantConfig.name);
        
        if (existingAssistant) {
          await openai.beta.assistants.update(existingAssistant.id, {
            instructions: assistantConfig.system_prompt_template
          });
          console.log(`✓ Force updated ${assistantConfig.name}`);
          updated++;
        }
      }

      // Update report generator
      const reportConfigPath = path.join(
        __dirname,
        `../../config/report_generators/${funnelId}_report.json`
      );
      
      if (fs.existsSync(reportConfigPath)) {
        const reportConfig = JSON.parse(fs.readFileSync(reportConfigPath, 'utf-8'));
        const existingReport = await findAssistantByName(reportConfig.name);
        
        if (existingReport) {
          await openai.beta.assistants.update(existingReport.id, {
            instructions: reportConfig.system_prompt
          });
          console.log(`✓ Force updated ${reportConfig.name}`);
          updated++;
        }
      }
    } catch (error) {
      console.error(`❌ Error updating assistants for funnel ${funnelId}:`, error.message);
    }
  }

  console.log(`\n✅ Force updated ${updated} assistant(s)\n`);
  return updated;
}

export async function verifyAssistantInstructions() {
  console.log('Verifying assistant instructions...\n');
  
  const funnelsConfig = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../config/funnels.json'),
      'utf-8'
    )
  );

  const funnelIds = funnelsConfig.funnels.map(f => f.id);

  for (const funnelId of funnelIds) {
    try {
      const assistantConfigPath = path.join(
        __dirname,
        `../../config/assistants/${funnelId}_assistant.json`
      );
      
      if (fs.existsSync(assistantConfigPath)) {
        const assistantConfig = JSON.parse(fs.readFileSync(assistantConfigPath, 'utf-8'));
        const existingAssistant = await findAssistantByName(assistantConfig.name);
        
        if (existingAssistant) {
          const hasNameInstruction = existingAssistant.instructions?.includes('CRITICAL: YOUR FIRST MESSAGE MUST ASK FOR THEIR NAME') ||
                                     existingAssistant.instructions?.includes('FIRST INTERACTION - GET THEIR NAME');
          
          console.log(`${assistantConfig.name}:`);
          console.log(`  ID: ${existingAssistant.id}`);
          console.log(`  Has name instruction: ${hasNameInstruction ? '✓' : '✗'}`);
          console.log(`  Instructions length: ${existingAssistant.instructions?.length || 0} chars\n`);
        } else {
          console.log(`${assistantConfig.name}: Not found\n`);
        }
      }
    } catch (error) {
      console.error(`Error checking ${funnelId}:`, error.message);
    }
  }
}

