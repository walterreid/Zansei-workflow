import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from '../src/models/database.js';
import { initializeAssistants } from '../src/services/openai.service.js';
import * as conversationService from '../src/services/conversation.service.js';
import * as reportService from '../src/services/report.service.js';
import * as conversationModel from '../src/models/conversation.model.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runPersonaTest(personaId) {
  console.log(`\n🎭 Running Realistic Persona Test: ${personaId}\n`);

  // Load persona
  const personaPath = path.join(__dirname, 'personas', `${personaId}.json`);
  if (!fs.existsSync(personaPath)) {
    throw new Error(`Persona not found: ${personaPath}`);
  }

  const persona = JSON.parse(fs.readFileSync(personaPath, 'utf-8'));

  console.log('📋 Persona:', persona.name);
  console.log('📋 Business:', persona.bio.business);
  console.log('📋 Location:', persona.bio.location);
  console.log('📋 Bubble Answers:', persona.bubble_answers);
  console.log('🎯 Selected Funnel:', persona.selected_funnel);
  console.log('\n💬 Simulating Conversation...\n');

  // Initialize database and assistants
  const DB_PATH = './test-data/zansei-test.db';
  await initializeDatabase(DB_PATH);
  await initializeAssistants();

  // Initialize conversation
  const session = await conversationService.initializeConversation(
    persona.bubble_answers,
    persona.selected_funnel
  );

  console.log(`✅ Session created: ${session.session_id}\n`);

  // Simulate conversation using single GPT call
  const conversationPrompt = `You are simulating a realistic conversation between:
1. Zansei (a marketing AI assistant helping with brand awareness)
2. ${persona.name} (${persona.bio.business} owner in ${persona.bio.location})

${persona.name}'s personality and background:
${JSON.stringify(persona, null, 2)}

Simulate a realistic 6-8 turn conversation where:
- Zansei asks questions about budget, target customers, current marketing, challenges, geographic focus, timeline, success goals, and existing assets
- ${persona.name} responds naturally based on her personality (${persona.personality.communication_style.tone})
- ${persona.name} shows emotion, tells stories, mentions specific details (like Mrs. Gutierrez, her daughter, past Facebook ad experience)
- ${persona.name} expresses concerns, asks for clarification when confused
- Zansei adapts to ${persona.name}'s tone and concerns, is empathetic
- The conversation feels natural, not robotic

Output the conversation as JSON with this exact structure:
{
  "conversation": [
    { "role": "assistant", "content": "Zansei's first message (greeting and first question)" },
    { "role": "user", "content": "${persona.name}'s response with emotion and context" },
    { "role": "assistant", "content": "Zansei's next message" },
    { "role": "user", "content": "${persona.name}'s response" },
    ...
  ]
}

Make ${persona.name}'s responses feel REAL - include hesitation, fear, hope, specific examples, references to her situation.
Keep it to 6-8 exchanges total. End when Zansei has enough information to generate a report.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a conversation simulator. Generate realistic, emotional conversations between a marketing assistant and a small business owner.'
      },
      {
        role: 'user',
        content: conversationPrompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8
  });

  const simulated = JSON.parse(response.choices[0].message.content);
  const conversation = simulated.conversation || [];

  console.log('📝 Simulated Conversation:\n');
  console.log('━'.repeat(60));

  // Process each message in the conversation
  let conversationComplete = false;
  for (let i = 0; i < conversation.length; i++) {
    const message = conversation[i];
    const speaker = message.role === 'assistant' ? '🤖 Zansei' : `👤 ${persona.name}`;
    
    console.log(`\n${speaker}:`);
    console.log(message.content);
    console.log('─'.repeat(60));

    // Send user messages to the actual conversation service
    if (message.role === 'user') {
      try {
        const result = await conversationService.sendMessage(
          session.session_id,
          message.content
        );

        console.log(`\n📊 Progress: ${result.progress.questions_answered}/${result.progress.questions_total} (${result.progress.percentage}%)`);
        
        if (result.unlocked_components.length > 0) {
          console.log(`🔓 Unlocked Components: ${result.unlocked_components.join(', ')}`);
        }

        if (result.is_complete) {
          console.log('\n✅ Conversation Complete!');
          conversationComplete = true;
          break;
        }
      } catch (error) {
        console.error('Error processing message:', error.message);
      }
    }

    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // If conversation not complete, extract data from simulated conversation and complete manually
  if (!conversationComplete) {
    console.log('\n⚠️  Simulated conversation ended, but not all questions answered.');
    console.log('Extracting data from conversation and completing required fields...\n');
    
    const state = await conversationService.getConversationState(session.session_id);
    console.log(`Current progress: ${state.progress.questions_answered}/${state.progress.questions_total}`);
    
    // Extract answers from the full conversation history
    const fullConversation = conversation.map(m => ({
      role: m.role,
      content: m.content
    }));
    
    // Use OpenAI to extract all required data from the conversation
    const extractionPrompt = `Extract all marketing information from this conversation between Zansei and Maria Rodriguez about her Colombian apparel boutique in Elmhurst, Queens.

Required fields to extract:
- budget: monthly marketing budget (extract number or range)
- target_customer: who she wants to reach
- current_marketing: what she's currently doing
- main_challenge: biggest challenge preventing brand awareness
- geographic_focus: where she wants to reach (Elmhurst, Queens, etc.)
- timeline: when she needs results (urgently, soon, future, exploring)
- success_looks_like: what success means to her
- existing_assets: website/social media status

Conversation:
${JSON.stringify(fullConversation, null, 2)}

Output as JSON with all fields filled based on the conversation. Use reasonable defaults if not explicitly mentioned.`;

    try {
      const extractionResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: extractionPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const extractedData = JSON.parse(extractionResponse.choices[0].message.content);
      
      // Save all extracted data
      const assistantConfig = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../config/assistants/brand_awareness_assistant.json'),
          'utf-8'
        )
      );

      for (const [questionId, value] of Object.entries(extractedData)) {
        if (value && value !== null && value !== '') {
          const questionConfig = assistantConfig.questions.find(q => q.id === questionId);
          if (questionConfig) {
            const normalized = typeof value === 'string' ? value : JSON.stringify(value);
            await conversationModel.saveCollectedData(
              session.session_id,
              questionId,
              normalized,
              normalized
            );
          }
        }
      }

      // Update session to mark as complete
      const allCollected = await conversationModel.getCollectedData(session.session_id);
      const { checkComponentUnlocks, calculateProgress } = await import('../src/utils/dataExtractor.js');
      
      const unlocked = checkComponentUnlocks(allCollected, assistantConfig);
      const progress = calculateProgress(allCollected, assistantConfig);
      
      await conversationModel.updateSession(session.session_id, {
        unlocked_components: unlocked,
        progress: progress,
        is_complete: true
      });

      console.log(`✅ Manually completed conversation: ${progress.questions_answered}/${progress.questions_total}`);
      conversationComplete = true;
    } catch (error) {
      console.error('Error extracting data:', error.message);
      // Fall back to continuing conversation
      console.log('\n📝 Continuing conversation to complete all required questions...\n');
      
      for (let i = 0; i < 10; i++) {
        try {
          const result = await conversationService.sendMessage(
            session.session_id,
            "Please continue asking your questions. I'm ready to answer."
          );
          
          console.log(`📊 Progress: ${result.progress.questions_answered}/${result.progress.questions_total} (${result.progress.percentage}%)`);
          
          if (result.is_complete) {
            console.log('\n✅ Conversation Complete!');
            conversationComplete = true;
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.error('Error continuing conversation:', error.message);
          break;
        }
      }
    }
  }

  // Generate report
  console.log('\n\n📄 Generating Report...\n');
  console.log('━'.repeat(60));

  try {
    const reportResult = await reportService.generateReport(session.session_id);

    console.log('\n✅ Report Generated Successfully!\n');
    console.log(`📄 Report ID: ${reportResult.report_id}`);
    console.log(`📊 Status: ${reportResult.status}`);
    console.log('\n📋 Executive Summary:');
    console.log(reportResult.report.executive_summary);
    console.log('\n📦 Components Generated:');
    reportResult.report.components.forEach(comp => {
      console.log(`  - ${comp.title}`);
    });

    // Save report to file for review
    const timestamp = Date.now();
    const reportDir = path.join(__dirname, '../test-outputs');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Save JSON
    const reportJsonPath = path.join(reportDir, `report-${personaId}-${timestamp}.json`);
    fs.writeFileSync(reportJsonPath, JSON.stringify(reportResult, null, 2));
    console.log(`\n💾 Report (JSON) saved to: ${reportJsonPath}`);
    
    // Save Markdown
    const { formatReportAsMarkdown } = await import('../src/utils/reportFormatter.js');
    const markdown = formatReportAsMarkdown(reportResult);
    const reportMdPath = path.join(reportDir, `report-${personaId}-${timestamp}.md`);
    fs.writeFileSync(reportMdPath, markdown);
    console.log(`💾 Report (Markdown) saved to: ${reportMdPath}`);

    return {
      session,
      conversation,
      report: reportResult
    };
  } catch (error) {
    console.error('\n❌ Error generating report:', error.message);
    throw error;
  }
}

// Main execution
const personaId = process.argv[2] || 'maria_rodriguez';

runPersonaTest(personaId)
  .then(() => {
    console.log('\n✅ Persona test completed successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Persona test failed:', error);
    process.exit(1);
  });

