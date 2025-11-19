import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildSystemPrompt(bubbleAnswers, assistantConfig) {
  let systemPrompt = assistantConfig.system_prompt_template;

  // Extract values from bubble answers
  const businessType = bubbleAnswers.business_type?.value || bubbleAnswers.business_type || 'business';
  const geography = bubbleAnswers.geography?.value || bubbleAnswers.geography || 'area';
  const marketingMaturity = bubbleAnswers.marketing_maturity?.value || bubbleAnswers.marketing_maturity || 'basics';
  const industryBucket = bubbleAnswers.business_type?.industry_bucket || 'other';

  // Determine business size (simple heuristic)
  const businessSize = 'small'; // Default for MVP

  // Replace placeholders
  systemPrompt = systemPrompt.replace(/{business_type}/g, businessType);
  systemPrompt = systemPrompt.replace(/{geography}/g, geography);
  systemPrompt = systemPrompt.replace(/{marketing_maturity}/g, marketingMaturity);
  systemPrompt = systemPrompt.replace(/{industry_bucket}/g, industryBucket);
  systemPrompt = systemPrompt.replace(/{business_size}/g, businessSize);

  return systemPrompt;
}

export function getAssistantConfig(funnelId) {
  const configPath = path.join(
    __dirname,
    `../../config/assistants/${funnelId}_assistant.json`
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(`Assistant config not found for funnel: ${funnelId}`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

