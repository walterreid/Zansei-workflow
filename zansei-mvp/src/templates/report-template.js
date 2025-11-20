/**
 * Beautiful HTML Report Template
 * Generates print-ready, shareable HTML reports
 */

export function renderReportHTML(reportContent, session) {
  const {
    component_id,
    component_name,
    executive_summary,
    sections = []
  } = reportContent;

  const businessContext = session.business_context || {};
  const personaName = session.user_name || session.persona_name || 'Business Owner';
  const collectedData = session.collected_data || {};
  const sessionId = session.session_id || null; // Get session ID from session object

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${component_name} - ${personaName}</title>
  <style>
    :root {
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-600: #4b5563;
      --gray-900: #111827;
      --green: #22c55e;
      --green-dark: #166534;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--gray-900);
      background: var(--gray-50);
      padding: 2rem;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 3rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .header {
      border-bottom: 3px solid var(--primary);
      padding-bottom: 2rem;
      margin-bottom: 2rem;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 1rem;
    }
    
    .report-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 0.5rem;
    }
    
    .report-subtitle {
      font-size: 1.25rem;
      color: var(--gray-600);
    }
    
    .business-info {
      background: var(--gray-50);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    
    .business-info h3 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--gray-600);
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .business-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    
    .info-item {
      display: flex;
      gap: 0.5rem;
    }
    
    .info-label {
      font-weight: 600;
      color: var(--gray-900);
    }
    
    .info-value {
      color: var(--gray-600);
    }
    
    .executive-summary {
      background: linear-gradient(to right, #eff6ff, #fef3c7);
      border-left: 4px solid var(--primary);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    
    .executive-summary h3 {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: var(--primary-dark);
    }
    
    .executive-summary p {
      font-size: 1.1rem;
      line-height: 1.8;
    }
    
    .section {
      margin-bottom: 3rem;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--gray-200);
    }
    
    .section-icon {
      font-size: 2rem;
    }
    
    .section-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--gray-900);
    }
    
    .section-content {
      font-size: 1rem;
      line-height: 1.8;
      color: var(--gray-600);
    }
    
    .section-content h4 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--gray-900);
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }
    
    .section-content p {
      margin-bottom: 1rem;
    }
    
    .section-content ul,
    .section-content ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }
    
    .section-content li {
      margin-bottom: 0.5rem;
    }
    
    .highlight-box {
      background: var(--gray-50);
      border-left: 4px solid var(--primary);
      padding: 1rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }
    
    .budget-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }
    
    .budget-table th,
    .budget-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--gray-200);
    }
    
    .budget-table th {
      background: var(--gray-100);
      font-weight: 600;
      color: var(--gray-900);
    }
    
    .budget-table tr:hover {
      background: var(--gray-50);
    }
    
    .action-items {
      background: #f0fdf4;
      border-left: 4px solid var(--green);
      padding: 1.5rem;
      border-radius: 8px;
      margin: 2rem 0;
    }
    
    .action-items h4 {
      color: var(--green-dark);
      margin-bottom: 1rem;
    }
    
    .action-items ul {
      list-style: none;
      margin-left: 0;
    }
    
    .action-items li {
      position: relative;
      padding-left: 1.5rem;
      margin-bottom: 0.75rem;
    }
    
    .action-items li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: var(--green);
      font-weight: bold;
    }
    
    .footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 2px solid var(--gray-200);
      text-align: center;
      color: var(--gray-600);
      font-size: 0.875rem;
    }
    
    .print-button, .back-button {
      position: fixed;
      top: 2rem;
      right: 2rem;
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.2s;
      z-index: 1000;
    }
    
    .back-button {
      top: 2rem;
      right: 12rem;
      background: var(--gray-600);
    }
    
    .back-button:hover {
      background: var(--gray-900);
      transform: translateY(-2px);
      box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
    }
    
    .print-button:hover {
      background: var(--primary-dark);
      transform: translateY(-2px);
      box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .print-button {
        display: none;
      }
      .container {
        box-shadow: none;
        padding: 1rem;
      }
    }
    
    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }
      .container {
        padding: 1.5rem;
      }
      .report-title {
        font-size: 1.75rem;
      }
      .business-info-grid {
        grid-template-columns: 1fr;
      }
      .print-button {
        top: 1rem;
        right: 1rem;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
      }
    }
  </style>
</head>
<body>
  ${sessionId ? `<button class="back-button" onclick="window.location.href='${typeof window !== 'undefined' ? window.location.origin : ''}/?session=${sessionId}'">← Back to Conversation</button>` : ''}
  <button class="print-button" onclick="window.print()">🖨️ Print / Save PDF</button>
  
  <div class="container">
    <div class="header">
      <div class="logo">
        🎯 Zansei
      </div>
      <h1 class="report-title">${component_name || 'Marketing Strategy Report'}</h1>
      <p class="report-subtitle">Personalized Strategy for ${personaName}</p>
    </div>
    
    <div class="business-info">
      <h3>Business Profile</h3>
      <div class="business-info-grid">
        <div class="info-item">
          <span class="info-label">Business Type:</span>
          <span class="info-value">${businessContext.business_type_label || businessContext.business_type || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Location:</span>
          <span class="info-value">${businessContext.geography_label || businessContext.geography || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Marketing Stage:</span>
          <span class="info-value">${businessContext.marketing_maturity_label || businessContext.marketing_maturity || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Budget:</span>
          <span class="info-value">${collectedData.budget?.raw_answer || collectedData.budget?.normalized_value || 'Varies'}</span>
        </div>
      </div>
    </div>
    
    ${executive_summary ? `
    <div class="executive-summary">
      <h3>Executive Summary</h3>
      <p>${executive_summary}</p>
    </div>
    ` : ''}
    
    ${sections.map(section => `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">${section.icon || '📊'}</span>
          <h2 class="section-title">${section.heading || section.title || 'Details'}</h2>
        </div>
        <div class="section-content">
          ${formatSectionContent(section.content)}
        </div>
      </div>
    `).join('')}
    
    <div class="footer">
      <p>Generated by Zansei Marketing Intelligence • ${new Date().toLocaleDateString()}</p>
      <p>This report is personalized for ${personaName} based on your specific business context.</p>
    </div>
  </div>
  
  <script>
    // Add smooth scroll for any internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  </script>
</body>
</html>`;
}

function formatSectionContent(content) {
  if (!content) return '';
  
  // Convert markdown-like formatting to HTML
  let formatted = String(content);
  
  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Convert numbered lists
  formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  if (formatted.includes('<li>')) {
    formatted = '<ol>' + formatted.replace(/<li>/g, '<li>') + '</ol>';
  }
  
  // Convert bullet points
  formatted = formatted.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  if (formatted.includes('<li>') && !formatted.includes('<ol>')) {
    formatted = '<ul>' + formatted + '</ul>';
  }
  
  // Convert line breaks to paragraphs
  const paragraphs = formatted.split(/\n\n+/).filter(p => p.trim());
  formatted = paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
  
  return formatted;
}

