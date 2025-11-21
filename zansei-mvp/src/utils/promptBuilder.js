import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { knowledgeService } from '../services/knowledge.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildSystemPrompt(bubbleAnswers, assistantConfig, userName = null, funnelId = null) {
  let systemPrompt = assistantConfig.system_prompt_template;

  // Extract values from bubble answers
  const businessType = bubbleAnswers.business_type?.value || bubbleAnswers.business_type || 'business';
  const geography = bubbleAnswers.geography?.value || bubbleAnswers.geography || 'area';
  const marketingMaturity = bubbleAnswers.marketing_maturity?.value || bubbleAnswers.marketing_maturity || 'basics';
  const industryBucket = bubbleAnswers.business_type?.industry_bucket || 'other';

  // Determine business size (simple heuristic)
  const businessSize = 'small'; // Default for MVP

  // Use provided name or default
  const name = userName || 'Business Owner';

  // Get funnel ID from assistant config if not provided
  const currentFunnelId = funnelId || assistantConfig.funnel_id;

  // Load knowledge base
  let knowledgeSection = '';
  try {
    const knowledge = await knowledgeService.getKnowledge(currentFunnelId, businessType);
    
    if (knowledge) {
      knowledgeSection = '\n\n=== KNOWLEDGE BASE ===\n\n';
      
      // Inject Zan Ng persona (always included)
      if (knowledge.persona) {
        knowledgeSection += `[ZAN NG PERSONA]\n${knowledge.persona}\n\n`;
      }
      
      // Inject SMB insights (always included)
      if (knowledge.smb_insights) {
        knowledgeSection += `[SMALL BUSINESS INSIGHTS]\n${knowledge.smb_insights}\n\n`;
      }
      
      // Inject funnel-specific tactics (if available)
      if (knowledge.funnel_tactics) {
        knowledgeSection += `[FUNNEL-SPECIFIC TACTICS - ${currentFunnelId}]\n${knowledge.funnel_tactics}\n\n`;
      }
      
      // Inject industry-specific insights (if available)
      if (knowledge.industry_specific) {
        knowledgeSection += `[INDUSTRY-SPECIFIC INSIGHTS - ${businessType}]\n${knowledge.industry_specific}\n\n`;
      }
      
      // Inject benchmarks (if available)
      if (knowledge.benchmarks) {
        knowledgeSection += `[CURRENT MARKET BENCHMARKS]\nLast Updated: ${knowledge.benchmarks.last_updated || 'Unknown'}\n\n`;
        knowledgeSection += `Use these benchmarks to inform realistic recommendations:\n${JSON.stringify(knowledge.benchmarks, null, 2)}\n\n`;
      }
      
      knowledgeSection += '=== END KNOWLEDGE BASE ===\n\n';
      knowledgeSection += 'IMPORTANT: Use this knowledge base to inform your recommendations, but speak naturally. Don\'t recite the knowledge base verbatim - internalize it and apply it contextually to the user\'s specific situation.\n\n';
    }
  } catch (error) {
    console.warn('[promptBuilder] Error loading knowledge base:', error.message);
    // Continue without knowledge if loading fails
  }

  // Replace placeholders
  systemPrompt = systemPrompt.replace(/{name}/g, name);
  systemPrompt = systemPrompt.replace(/{business_type}/g, businessType);
  systemPrompt = systemPrompt.replace(/{geography}/g, geography);
  systemPrompt = systemPrompt.replace(/{marketing_maturity}/g, marketingMaturity);
  systemPrompt = systemPrompt.replace(/{industry_bucket}/g, industryBucket);
  systemPrompt = systemPrompt.replace(/{business_size}/g, businessSize);

  // Inject knowledge section after base template but before conversation rules
  // Insert after the initial context, before "CRITICAL:" sections
  const criticalIndex = systemPrompt.indexOf('**CRITICAL:');
  if (criticalIndex > 0 && knowledgeSection) {
    systemPrompt = systemPrompt.slice(0, criticalIndex) + knowledgeSection + systemPrompt.slice(criticalIndex);
  } else if (knowledgeSection) {
    // If no CRITICAL section found, append at the end
    systemPrompt = systemPrompt + knowledgeSection;
  }

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

