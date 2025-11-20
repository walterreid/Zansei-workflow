import * as conversationModel from '../models/conversation.model.js';
import * as openaiService from './openai.service.js';
import { renderReportHTML } from '../templates/report-template.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateComponentReport(sessionId, componentId) {
  try {
    console.log(`[DEBUG] generateComponentReport: sessionId=${sessionId}, componentId=${componentId}`);
    
    // Get session and collected data
    const session = await conversationModel.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const collectedData = await conversationModel.getCollectedData(sessionId);
    console.log(`[DEBUG] Retrieved ${Object.keys(collectedData).length} fields of collected data`);
    
    // Note: conversationHistory is not currently used in report generation, but kept for future use
    // const conversationHistory = await conversationModel.getConversationHistory(sessionId);

    // Get component config
    const componentConfig = getComponentConfig(session.selected_funnel.id, componentId);
    if (!componentConfig) {
      throw new Error(`Component not found: ${componentId} for funnel: ${session.selected_funnel.id}`);
    }
    console.log(`[DEBUG] Component config found: ${componentConfig.name}`);

    // Build report request for this specific component
    const reportRequest = buildComponentReportRequest(session, collectedData, componentId, componentConfig);

    // Get report generator assistant ID
    const reportAssistantId = openaiService.getAssistantId(session.selected_funnel.id, 'report');
    if (!reportAssistantId) {
      throw new Error(`Report generator assistant not initialized for funnel: ${session.selected_funnel.id}`);
    }
    console.log(`[DEBUG] Using report assistant: ${reportAssistantId}`);

    // Generate component-specific report
    const reportData = await generateComponentContentWithAssistant(
      reportAssistantId,
      reportRequest,
      componentConfig
    );
    console.log(`[DEBUG] Report data generated successfully`);

    // Format as HTML (pass session ID for back button)
    const html = renderReportHTML(reportData, {
      business_context: buildBusinessContext(session),
      collected_data: collectedData,
      user_name: session.user_name || session.user_id || 'Business Owner',
      persona_name: session.user_name || session.user_id || 'Business Owner',
      session_id: sessionId // Pass session ID for back button
    });
    console.log(`[DEBUG] HTML report rendered, length: ${html.length} characters`);

    // Save HTML file
    const reportsDir = path.join(__dirname, '../../generated_reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filename = `report-${componentId}-${sessionId.substring(0, 8)}-${Date.now()}.html`;
    const filepath = path.join(reportsDir, filename);
    fs.writeFileSync(filepath, html);
    console.log(`[DEBUG] Report saved to: ${filepath}`);

    return {
      filename,
      filepath,
      html,
      component_id: componentId,
      component_name: componentConfig.name,
      report_data: reportData
    };
  } catch (error) {
    console.error(`[ERROR] generateComponentReport failed:`, error);
    throw error; // Re-throw to let route handler catch it
  }
}

function getComponentConfig(funnelId, componentId) {
  try {
    const assistantConfigPath = path.join(
      __dirname,
      `../../config/assistants/${funnelId}_assistant.json`
    );
    const assistantConfig = JSON.parse(fs.readFileSync(assistantConfigPath, 'utf-8'));
    
    return assistantConfig.report_components.find(c => c.id === componentId);
  } catch (error) {
    console.error('Error loading component config:', error);
    return null;
  }
}

function buildBusinessContext(session) {
  const bubbleAnswers = session.bubble_answers;
  
  // Load funnel config for labels
  const funnelsConfig = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../config/funnels.json'),
      'utf-8'
    )
  );

  const businessTypeOption = funnelsConfig.bubble_questions[0].options.find(
    opt => opt.value === (bubbleAnswers.business_type?.value || bubbleAnswers.business_type)
  );

  const geographyOption = funnelsConfig.bubble_questions[1].options.find(
    opt => opt.value === (bubbleAnswers.geography?.value || bubbleAnswers.geography)
  );

  const maturityOption = funnelsConfig.bubble_questions[2].options.find(
    opt => opt.value === (bubbleAnswers.marketing_maturity?.value || bubbleAnswers.marketing_maturity)
  );

  return {
    business_type: bubbleAnswers.business_type?.value || bubbleAnswers.business_type,
    business_type_label: businessTypeOption?.label || bubbleAnswers.business_type,
    industry_bucket: businessTypeOption?.industry_bucket || 'other',
    geography: bubbleAnswers.geography?.value || bubbleAnswers.geography,
    geography_label: geographyOption?.label || bubbleAnswers.geography,
    marketing_maturity: bubbleAnswers.marketing_maturity?.value || bubbleAnswers.marketing_maturity,
    marketing_maturity_label: maturityOption?.label || bubbleAnswers.marketing_maturity,
    user_name: session.user_name || null
  };
}

function buildComponentReportRequest(session, collectedData, componentId, componentConfig) {
  const businessContext = buildBusinessContext(session);

  return {
    session_id: session.session_id,
    funnel_id: session.selected_funnel.id,
    component_id: componentId,
    component_name: componentConfig.name,
    business_context: businessContext,
    collected_answers: Object.fromEntries(
      Object.entries(collectedData).map(([key, value]) => [
        key,
        value.normalized_value || value.raw_answer
      ])
    )
  };
}

async function generateComponentContentWithAssistant(assistantId, reportRequest, componentConfig) {
  try {
    const thread = await openaiService.createThread();

    const requestMessage = `Generate a detailed ${componentConfig.name} report section for this business.

Business Context:
${JSON.stringify(reportRequest.business_context, null, 2)}

Collected Information:
${JSON.stringify(reportRequest.collected_answers, null, 2)}

Generate ONLY the ${componentConfig.name} section. This should be:
- Highly specific to their business (${reportRequest.business_context.business_type} in ${reportRequest.business_context.geography})
- Actionable with concrete steps
- Budget-realistic (they have ${reportRequest.collected_answers.budget || 'limited'} budget)
- Industry-appropriate for ${reportRequest.business_context.business_type}

Output as RAW JSON (no markdown code blocks, no code formatting, just the JSON object) with this structure:
{
  "component_id": "${componentConfig.id}",
  "component_name": "${componentConfig.name}",
  "executive_summary": "2-3 sentence summary of this component's strategy",
  "sections": [
    {
      "heading": "Section Title",
      "content": "Detailed content with actionable steps, specific examples, and concrete numbers",
      "icon": "📊"
    }
  ]
}

CRITICAL: Output ONLY the JSON object, no markdown formatting, no code blocks, no explanations before or after. Start with { and end with }.

Make it feel like it was built FOR THEM. Reference their specific situation throughout.`;

    console.log(`[DEBUG] Generating report for component: ${componentConfig.id}`);
    let responseText = await openaiService.sendMessage(thread, assistantId, requestMessage);
    console.log(`[DEBUG] Report generation response length: ${responseText.length} characters`);

    // Strip markdown code blocks if present
    responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    console.log(`[DEBUG] After stripping markdown, length: ${responseText.length} characters`);

    // Try to extract JSON from the response (look for first { to last })
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[DEBUG] Successfully parsed report JSON`);
        return parsed;
      } catch (error) {
        console.error('[ERROR] Error parsing component report JSON:', error);
        console.error('[ERROR] JSON snippet (first 200 chars):', jsonMatch[0].substring(0, 200));
        console.error('[ERROR] JSON snippet (last 200 chars):', jsonMatch[0].substring(Math.max(0, jsonMatch[0].length - 200)));
        
        // Try to fix common JSON issues
        let cleanedJson = jsonMatch[0];
        // Remove trailing commas before } or ]
        cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');
        // Remove comments (though JSON doesn't support them)
        cleanedJson = cleanedJson.replace(/\/\/.*$/gm, '');
        cleanedJson = cleanedJson.replace(/\/\*[\s\S]*?\*\//g, '');
        
        try {
          const fixed = JSON.parse(cleanedJson);
          console.log('[DEBUG] Successfully parsed after cleaning');
          return fixed;
        } catch (e2) {
          console.error('[ERROR] Could not fix JSON:', e2);
          console.error('[ERROR] Full response text (first 1000 chars):', responseText.substring(0, 1000));
          throw new Error(`Failed to parse report JSON: ${error.message}. After cleaning: ${e2.message}`);
        }
      }
    }

    // Fallback structure
    console.log(`[DEBUG] Using fallback structure for report`);
    return {
      component_id: componentConfig.id,
      component_name: componentConfig.name,
      executive_summary: responseText.substring(0, 300) || `Strategy for ${componentConfig.name}`,
      sections: [
        {
          heading: 'Strategy Details',
          content: responseText || 'Report content will be generated here.',
          icon: '📊'
        }
      ]
    };
  } catch (error) {
    console.error(`[ERROR] Failed to generate component report:`, error);
    throw new Error(`Report generation failed: ${error.message}`);
  }
}

