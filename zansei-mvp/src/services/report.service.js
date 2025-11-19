import * as conversationModel from '../models/conversation.model.js';
import * as reportModel from '../models/report.model.js';
import * as openaiService from './openai.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateReport(sessionId) {
  // Get session and collected data
  const session = await conversationModel.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (!session.is_complete) {
    throw new Error('Conversation is not complete. Cannot generate report yet.');
  }

  const collectedData = await conversationModel.getCollectedData(sessionId);
  const conversationHistory = await conversationModel.getConversationHistory(sessionId);

  // Build report request
  const reportRequest = buildReportRequest(session, collectedData);

  // Get report generator assistant ID
  const reportAssistantId = openaiService.getAssistantId('brand_awareness_report');
  if (!reportAssistantId) {
    throw new Error('Report generator assistant not initialized.');
  }

  // Create report record
  const reportId = await reportModel.createReport(sessionId, {}, 'generating');

  try {
    // Generate report using OpenAI
    const reportData = await openaiService.generateReportWithAssistant(
      reportAssistantId,
      reportRequest
    );

    // Validate report
    const validatedReport = validateReport(reportData);

    // Update report record
    await reportModel.updateReportStatus(reportId, 'complete', validatedReport);

    // Also save markdown version (optional, for easier reading)
    try {
      const { formatReportAsMarkdown } = await import('../utils/reportFormatter.js');
      const markdown = formatReportAsMarkdown({
        report_id: reportId,
        report: validatedReport
      });
      
      // Store markdown in report data for potential future use
      validatedReport.markdown = markdown;
    } catch (error) {
      console.warn('Could not generate markdown version:', error.message);
    }

    return {
      report_id: reportId,
      report: validatedReport,
      status: 'complete'
    };
  } catch (error) {
    console.error('Error generating report:', error);
    await reportModel.updateReportStatus(reportId, 'failed');
    throw error;
  }
}

function buildReportRequest(session, collectedData) {
  const bubbleAnswers = session.bubble_answers;
  const funnel = session.selected_funnel;

  // Get funnel config for labels
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
    session_id: session.session_id,
    funnel_id: funnel.id,
    business_context: {
      business_type: bubbleAnswers.business_type?.value || bubbleAnswers.business_type,
      business_type_label: businessTypeOption?.label || bubbleAnswers.business_type,
      industry_bucket: businessTypeOption?.industry_bucket || 'other',
      geography: bubbleAnswers.geography?.value || bubbleAnswers.geography,
      geography_label: geographyOption?.label || bubbleAnswers.geography,
      marketing_maturity: bubbleAnswers.marketing_maturity?.value || bubbleAnswers.marketing_maturity,
      marketing_maturity_label: maturityOption?.label || bubbleAnswers.marketing_maturity
    },
    collected_answers: Object.fromEntries(
      Object.entries(collectedData).map(([key, value]) => [
        key,
        value.normalized_value || value.raw_answer
      ])
    ),
    report_components_to_generate: session.unlocked_components || []
  };
}

function validateReport(reportData) {
  // Ensure required structure exists
  const validated = {
    executive_summary: reportData.executive_summary || 'Executive summary not generated.',
    components: reportData.components || [],
    timeline: reportData.timeline || { weeks: [] }
  };

  // Ensure all components have required fields
  validated.components = validated.components.map(component => ({
    id: component.id || 'unknown',
    title: component.title || 'Untitled Component',
    sections: component.sections || []
  }));

  return validated;
}

export async function getReport(reportId) {
  return await reportModel.getReport(reportId);
}

export async function getReportBySession(sessionId) {
  return await reportModel.getReportBySessionId(sessionId);
}

