export function normalizeAnswer(rawAnswer, questionConfig) {
  if (!rawAnswer) return null;

  const answer = String(rawAnswer).trim();

  // Handle select questions
  if (questionConfig.type === 'select' && questionConfig.options) {
    // Try to find exact match
    const exactMatch = questionConfig.options.find(
      opt => opt === answer || opt.value === answer || opt.label === answer
    );
    if (exactMatch) {
      return exactMatch.value || exactMatch;
    }

    // Try partial match
    const partialMatch = questionConfig.options.find(
      opt => {
        const optStr = String(opt.value || opt.label || opt).toLowerCase();
        return optStr.includes(answer.toLowerCase()) || answer.toLowerCase().includes(optStr);
      }
    );
    if (partialMatch) {
      return partialMatch.value || partialMatch;
    }

    // Return as-is if no match
    return answer;
  }

  // Handle select_multiple
  if (questionConfig.type === 'select_multiple') {
    if (Array.isArray(answer)) {
      return answer;
    }
    // Try to parse as array
    try {
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, treat as comma-separated
      return answer.split(',').map(s => s.trim()).filter(s => s);
    }
  }

  // For text/textarea, return as-is but clean up
  return answer;
}

export function checkComponentUnlocks(collectedData, assistantConfig) {
  const unlocked = new Set();

  for (const component of assistantConfig.report_components) {
    const unlockConditions = component.unlock_conditions || [];
    const allConditionsMet = unlockConditions.every(questionId => {
      return collectedData[questionId] && collectedData[questionId].normalized_value;
    });

    if (allConditionsMet) {
      unlocked.add(component.id);
    }
  }

  return Array.from(unlocked);
}

export function calculateProgress(collectedData, assistantConfig) {
  const requiredQuestions = assistantConfig.questions.filter(q => q.required);
  const total = requiredQuestions.length;
  const answered = requiredQuestions.filter(q => {
    const data = collectedData[q.id];
    return data && data.normalized_value;
  }).length;

  const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
  const isComplete = answered === total;

  return {
    questions_answered: answered,
    questions_total: total,
    percentage,
    is_complete: isComplete
  };
}

