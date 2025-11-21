// State
let currentSession = null;
let bubbleAnswers = {};
let selectedFunnel = null;
let conversationState = null;

// API Base URL
const API_BASE = '/api';

// DOM Elements
const bubbleSection = document.getElementById('bubble-section');
const funnelSection = document.getElementById('funnel-section');
const conversationSection = document.getElementById('conversation-section');
const reportSection = document.getElementById('report-section');
const loadingOverlay = document.getElementById('loading-overlay');

// Initialize
async function init() {
  await loadBubbleQuestions();
  await loadFunnels();
  
  // Check if there's a saved session to restore (from localStorage or URL)
  const urlParams = new URLSearchParams(window.location.search);
  const urlSession = urlParams.get('session');
  const savedSession = urlSession || localStorage.getItem('zansei_session_id');
  
  if (savedSession) {
    try {
      await restoreConversation(savedSession);
    } catch (error) {
      console.warn('Could not restore conversation:', error);
      localStorage.removeItem('zansei_session_id');
    }
  }
}

// Restore conversation from saved session
async function restoreConversation(sessionId) {
  try {
    showLoading();
    
    // Fetch conversation state
    const response = await fetch(`${API_BASE}/conversation/${sessionId}`);
    if (!response.ok) {
      throw new Error('Session not found');
    }
    
    const data = await response.json();
    currentSession = sessionId;
    localStorage.setItem('zansei_session_id', sessionId);
    
    // Hide bubble and funnel sections, show conversation
    bubbleSection.classList.add('hidden');
    funnelSection.classList.add('hidden');
    conversationSection.classList.remove('hidden');
    
    // Add debug toggle
    addDebugToggle();
    
    // Load conversation history
    const history = data.conversation || data.messages || [];
    const messagesContainer = document.getElementById('conversation-messages');
    messagesContainer.innerHTML = ''; // Clear any existing messages
    
    history.forEach(msg => {
      addMessage(msg.role, msg.content);
    });
    
    // Update progress and components
    updateProgress(data.progress);
    updateComponents(
      data.unlocked_components || [],
      data.partial_components || [],
      data.locked_components || [],
      data.component_definitions || null
    );
    
    hideLoading();
  } catch (error) {
    console.error('Error restoring conversation:', error);
    hideLoading();
    throw error;
  }
}

// Load Bubble Questions
async function loadBubbleQuestions() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    
    // For MVP, we'll hardcode the questions
    const questions = [
      {
        id: 'business_type',
        question: "What best describes your business?",
        options: [
          { value: 'local_storefront', label: '🏪 Local storefront/physical location' },
          { value: 'restaurant', label: '🍕 Restaurant/food service' },
          { value: 'professional_services', label: '💼 Professional services' },
          { value: 'ecommerce', label: '🛒 E-commerce/online store' },
          { value: 'other', label: '✨ Other' }
        ]
      },
      {
        id: 'geography',
        question: "Where do you serve customers?",
        options: [
          { value: 'hyperlocal', label: '📍 Specific neighborhood/city' },
          { value: 'regional', label: '🗺️ Regional (state or multi-city)' },
          { value: 'national', label: '🇺🇸 Nationwide (US)' },
          { value: 'online_only', label: '💻 Online-only' }
        ]
      },
      {
        id: 'marketing_maturity',
        question: "What's your current marketing situation?",
        options: [
          { value: 'new', label: '🆕 Haven\'t really done marketing yet' },
          { value: 'basics', label: '🔍 Doing some basics' },
          { value: 'ads_running', label: '📊 Running ads but want to improve' },
          { value: 'experienced', label: '🎯 Experienced, looking to optimize' }
        ]
      }
    ];

    const container = document.getElementById('bubble-questions');
    questions.forEach(q => {
      const group = document.createElement('div');
      group.className = 'question-group';
      
      const label = document.createElement('label');
      label.textContent = q.question;
      group.appendChild(label);
      
      const select = document.createElement('select');
      select.id = q.id;
      select.innerHTML = '<option value="">Select...</option>' +
        q.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
      
      select.addEventListener('change', () => {
        bubbleAnswers[q.id] = { value: select.value };
        checkBubbleAnswers();
      });
      
      group.appendChild(select);
      container.appendChild(group);
    });

    document.getElementById('start-conversation-btn').addEventListener('click', showFunnelSelection);
  } catch (error) {
    console.error('Error loading questions:', error);
  }
}

function checkBubbleAnswers() {
  const btn = document.getElementById('start-conversation-btn');
  const required = ['business_type', 'geography', 'marketing_maturity'];
  const allAnswered = required.every(id => bubbleAnswers[id]?.value);
  btn.disabled = !allAnswered;
}

// Load Funnels
async function loadFunnels() {
  // All 6 funnels
  const funnels = [
    {
      id: 'customer_acquisition',
      label: '📉 Not Enough Customers',
      description: 'I need more sales, leads, or foot traffic'
    },
    {
      id: 'brand_awareness',
      label: '🔍 Nobody Knows About Us',
      description: 'People don\'t know my business exists'
    },
    {
      id: 'customer_retention',
      label: '🔄 Can\'t Keep Regular Customers',
      description: 'Customers don\'t come back or stay loyal'
    },
    {
      id: 'product_launch',
      label: '🚀 Launching Something New',
      description: 'I\'m launching a new product or service'
    },
    {
      id: 'competitive_strategy',
      label: '⚔️ Competing With Big Brands',
      description: 'Big competitors are outspending me'
    },
    {
      id: 'innovation',
      label: '💤 I Sleep on a Big Bag of Money',
      description: 'Just experimenting (I sleep like a baby)'
    }
  ];

  const container = document.getElementById('funnel-options');
  funnels.forEach(funnel => {
    const option = document.createElement('div');
    option.className = 'funnel-option';
    option.innerHTML = `
      <h3>${funnel.label}</h3>
      <p>${funnel.description}</p>
    `;
    
    option.addEventListener('click', () => {
      document.querySelectorAll('.funnel-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedFunnel = funnel;
      document.getElementById('select-funnel-btn').disabled = false;
    });
    
    container.appendChild(option);
  });

  document.getElementById('select-funnel-btn').addEventListener('click', startConversation);
}

function showFunnelSelection() {
  bubbleSection.classList.add('hidden');
  funnelSection.classList.remove('hidden');
}

// Start Conversation
async function startConversation() {
  showLoading();
  
  try {
    const response = await fetch(`${API_BASE}/conversation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bubble_answers: bubbleAnswers,
        selected_funnel_id: selectedFunnel.id
      })
    });

    if (!response.ok) throw new Error('Failed to start conversation');

    const data = await response.json();
    currentSession = data.session_id;
    
    // Save session to localStorage for persistence
    localStorage.setItem('zansei_session_id', currentSession);
    
    funnelSection.classList.add('hidden');
    conversationSection.classList.remove('hidden');
    
    // Add debug toggle button
    addDebugToggle();
    
    // Add first message
    addMessage('assistant', data.first_message);
    updateProgress(data.progress);
    updateComponents(
      data.unlocked_components || [],
      data.partial_components || [],
      data.locked_components || [],
      data.component_definitions || null
    );
    
    // Update debug panel if visible
    if (!document.getElementById('debug-panel').classList.contains('hidden')) {
      await updateDebugPanel();
    }
    
    hideLoading();
  } catch (error) {
    console.error('Error starting conversation:', error);
    alert('Failed to start conversation. Please try again.');
    hideLoading();
  }
}

// Send Message
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  
  if (!message || !currentSession) return;
  
  // Add user message to UI
  addMessage('user', message);
  input.value = '';
  showLoading();
  
  try {
    const response = await fetch(`${API_BASE}/conversation/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSession,
        message: message
      })
    });

    if (!response.ok) throw new Error('Failed to send message');

    const data = await response.json();
    
    // Add assistant response
    addMessage('assistant', data.response);
    
    // Handle upgrade completion message
    if (data.upgrade_complete && data.upgrade_message) {
      addMessage('assistant', data.upgrade_message);
    }
    
    updateProgress(data.progress);
    updateComponents(
      data.unlocked_components || [],
      data.partial_components || [],
      data.locked_components || [],
      data.component_definitions || null
    );
    
    // Show upgrade progress if in upgrade mode
    if (data.upgrade_mode && data.upgrade_progress) {
      const progress = data.upgrade_progress;
      showUpgradeProgress(progress.answered, progress.total);
    }
    
    // If conversation is complete, offer to generate report
    if (data.is_complete && !data.upgrade_mode) {
      setTimeout(() => {
        if (confirm('Conversation complete! Would you like to generate your report?')) {
          generateReport();
        }
      }, 1000);
    }
    
    hideLoading();
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
    hideLoading();
  }
}

// Add Message to UI
function addMessage(role, content) {
  const container = document.getElementById('conversation-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const roleSpan = document.createElement('div');
  roleSpan.className = 'message-role';
  roleSpan.textContent = role === 'assistant' ? 'Zansei' : 'You';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  
  messageDiv.appendChild(roleSpan);
  messageDiv.appendChild(contentDiv);
  container.appendChild(messageDiv);
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Update Progress
function updateProgress(progress) {
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  
  fill.style.width = `${progress.percentage}%`;
  text.textContent = `${progress.percentage}% (${progress.questions_answered}/${progress.questions_total})`;
}

// Update Components
function updateComponents(unlocked, partial = [], locked = [], componentDefinitions = null) {
  const container = document.getElementById('components-list');
  
  // Use provided component definitions if available, otherwise fall back to defaults
  let components = componentDefinitions;
  if (!components || components.length === 0) {
    // Fallback to default components (for backwards compatibility)
    components = [
      { id: 'content_strategy', name: '📝 Content Strategy', desc: 'What to post and when' },
      { id: 'channel_selection', name: '📱 Channel Selection', desc: 'Best platforms to reach your audience' },
      { id: 'local_visibility', name: '📍 Local Visibility', desc: 'Google Business Profile and local presence' },
      { id: 'budget_roi_tracking', name: '💰 Budget & ROI Tracking', desc: 'How to allocate and measure' },
      { id: 'quick_win_tactics', name: '⚡ Quick-Win Tactics', desc: 'Immediate actions to take' },
      { id: 'performance_metrics', name: '📊 Performance Metrics', desc: 'How to track success' }
    ];
  }

  container.innerHTML = '';
  components.forEach(comp => {
    const card = document.createElement('div');
    const isUnlocked = unlocked.includes(comp.id);
    const isPartial = partial.includes(comp.id);
    const status = isUnlocked ? 'unlocked' : (isPartial ? 'partial' : 'locked');
    
    card.className = `component-card ${status}`;
    
    let buttonsHtml = '';
    if (isUnlocked) {
      buttonsHtml = `
        <button class="btn-generate-report" onclick="generateComponentReport('${comp.id}')">
          📄 Generate Report
        </button>
      `;
    } else if (isPartial) {
      buttonsHtml = `
        <button class="btn-upgrade" onclick="startUpgrade('${comp.id}')">
          🔓 Answer Questions to Unlock
        </button>
      `;
    }
    
    card.innerHTML = `
      <h4>${comp.name}</h4>
      <p>${comp.desc}</p>
      ${buttonsHtml}
    `;
    container.appendChild(card);
  });
}

// Generate Report
async function generateReport() {
  showLoading();
  
  try {
    const response = await fetch(`${API_BASE}/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSession
      })
    });

    if (!response.ok) throw new Error('Failed to generate report');

    const data = await response.json();
    displayReport(data.report);
    
    conversationSection.classList.add('hidden');
    reportSection.classList.remove('hidden');
    
    hideLoading();
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Failed to generate report. Please try again.');
    hideLoading();
  }
}

// Display Report
function displayReport(report) {
  const container = document.getElementById('report-content');
  container.innerHTML = '';
  
  // Show back to conversation button if we have a session
  const backButton = document.getElementById('back-to-conversation-btn');
  if (currentSession) {
    backButton.style.display = 'inline-block';
    backButton.onclick = () => {
      // Hide report section, show conversation section
      reportSection.classList.add('hidden');
      conversationSection.classList.remove('hidden');
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  } else {
    backButton.style.display = 'none';
  }
  
  // Executive Summary
  const summary = document.createElement('div');
  summary.className = 'report-section';
  summary.innerHTML = `
    <h3>Executive Summary</h3>
    <p>${report.executive_summary || 'No summary available.'}</p>
  `;
  container.appendChild(summary);
  
  // Components
  if (report.components && report.components.length > 0) {
    report.components.forEach(component => {
      const compDiv = document.createElement('div');
      compDiv.className = 'report-section';
      
      let sectionsHtml = `<h3>${component.title || component.id}</h3>`;
      
      if (component.sections && component.sections.length > 0) {
        component.sections.forEach(section => {
          sectionsHtml += `<h4>${section.heading || ''}</h4>`;
          sectionsHtml += `<p>${section.content || ''}</p>`;
        });
      }
      
      compDiv.innerHTML = sectionsHtml;
      container.appendChild(compDiv);
    });
  }
  
  // Timeline
  if (report.timeline) {
    const timeline = document.createElement('div');
    timeline.className = 'report-section';
    timeline.innerHTML = `<h3>Implementation Timeline</h3><p>${JSON.stringify(report.timeline, null, 2)}</p>`;
    container.appendChild(timeline);
  }
}

// New Conversation from Report Section
document.getElementById('new-conversation-btn').addEventListener('click', () => {
  location.reload();
});

// New Conversation from Chat Section
document.getElementById('new-conversation-from-chat-btn').addEventListener('click', () => {
  resetConversation();
});

// Reset conversation and start fresh
function resetConversation() {
  // Clear session state
  currentSession = null;
  conversationState = null;
  bubbleAnswers = {};
  selectedFunnel = null;
  
  // Clear localStorage
  localStorage.removeItem('zansei_session_id');
  
  // Clear conversation messages
  const messagesContainer = document.getElementById('conversation-messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = '';
  }
  
  // Reset progress
  updateProgress({
    questions_answered: 0,
    questions_total: 0,
    percentage: 0,
    is_complete: false
  });
  
  // Clear components
  updateComponents([], [], [], null);
  
  // Hide conversation section, show bubble section
  conversationSection.classList.add('hidden');
  reportSection.classList.add('hidden');
  bubbleSection.classList.remove('hidden');
  
  // Reset bubble questions
  const bubbleQuestionsContainer = document.getElementById('bubble-questions');
  if (bubbleQuestionsContainer) {
    bubbleQuestionsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.checked = false;
    });
    document.getElementById('start-conversation-btn').disabled = true;
  }
  
  // Clear URL parameters
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Generate Component Report (global for onclick handlers)
window.generateComponentReport = async function(componentId) {
  if (!currentSession) return;
  
  showLoading();
  
  try {
    const response = await fetch(`${API_BASE}/report/generate-html/${componentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSession
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to generate component report');
    }

    const data = await response.json();
    console.log('Report generated:', data);
    
    if (data.view_url) {
      // Build full URL (handle both absolute and relative)
      const fullUrl = data.view_url.startsWith('http') 
        ? data.view_url 
        : `${window.location.origin}${data.view_url}`;
      
      console.log('Opening report at:', fullUrl);
      
      // Open report in new tab
      const reportWindow = window.open(fullUrl, '_blank');
      if (!reportWindow || reportWindow.closed || typeof reportWindow.closed === 'undefined') {
        // Popup blocked - redirect in same window or show link
        const userConfirmed = confirm(`Report generated successfully!\n\nClick OK to view the report, or Cancel to stay on this page.\n\nURL: ${fullUrl}`);
        if (userConfirmed) {
          window.location.href = fullUrl;
        }
      }
    } else {
      throw new Error('No view_url in response');
    }
    
    hideLoading();
  } catch (error) {
    console.error('Error generating component report:', error);
    alert(`Failed to generate report: ${error.message}`);
    hideLoading();
  }
};

// Start Upgrade Flow (global for onclick handlers)
window.startUpgrade = async function(componentId) {
  if (!currentSession) return;
  
  showLoading();
  
  try {
    const response = await fetch(`${API_BASE}/conversation/upgrade-component`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSession,
        component_id: componentId
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to start upgrade');
    }
    
    if (data.success !== false) {
      // Add upgrade message to conversation
      addMessage('assistant', data.message);
      
      // Show upgrade info if questions are needed
      if (data.questions_needed && data.questions_needed > 0) {
        showUpgradeInfo(data.component_name, data.questions_needed);
      }
      
      // Refresh conversation state to show updated components
      try {
        const stateResponse = await fetch(`${API_BASE}/conversation/${currentSession}`);
        if (stateResponse.ok) {
          const stateData = await stateResponse.json();
          updateProgress(stateData.progress);
          updateComponents(
            stateData.unlocked_components || [],
            stateData.partial_components || [],
            stateData.locked_components || [],
            stateData.component_definitions || null
          );
        }
      } catch (stateError) {
        console.warn('Could not refresh conversation state:', stateError);
        // Non-critical error, don't show alert
      }
    } else {
      alert(data.message || data.error || 'Could not start upgrade flow.');
    }
    
    hideLoading();
  } catch (error) {
    console.error('Error starting upgrade:', error);
    alert(`Failed to start upgrade: ${error.message}`);
    hideLoading();
  }
};

// Show Upgrade Progress
function showUpgradeProgress(answered, total) {
  const progressBar = document.getElementById('upgrade-progress');
  if (!progressBar) return;
  
  const percentage = (answered / total) * 100;
  progressBar.style.width = `${percentage}%`;
  progressBar.textContent = `${answered}/${total} questions answered`;
}

// Show Upgrade Info
function showUpgradeInfo(componentName, questionsNeeded) {
  const info = document.createElement('div');
  info.className = 'upgrade-info';
  info.innerHTML = `
    <p>🔓 Unlocking <strong>${componentName}</strong> requires ${questionsNeeded} more question(s).</p>
    <p>Answer the questions below to unlock this component.</p>
  `;
  
  const container = document.getElementById('conversation-messages');
  container.appendChild(info);
  
  setTimeout(() => {
    info.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// Loading
function showLoading() {
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Debug Panel Functions
let debugPanelVisible = false;

function addDebugToggle() {
  const header = document.querySelector('.conversation-header');
  if (header && !header.querySelector('.btn-debug-toggle')) {
    const debugBtn = document.createElement('button');
    debugBtn.className = 'btn-debug-toggle';
    debugBtn.textContent = '🔍 Show Debug';
    debugBtn.onclick = () => {
      const panel = document.getElementById('debug-panel');
      const toggleBtn = document.getElementById('toggle-debug');
      if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        toggleBtn.textContent = 'Hide';
        debugPanelVisible = true;
        updateDebugPanel();
        debugBtn.textContent = '🔍 Hide Debug';
      } else {
        panel.classList.add('hidden');
        toggleBtn.textContent = 'Show Debug';
        debugPanelVisible = false;
        debugBtn.textContent = '🔍 Show Debug';
      }
    };
    header.appendChild(debugBtn);
  }
}

// Initialize toggle-debug button event listener (only if element exists)
const toggleDebugBtn = document.getElementById('toggle-debug');
if (toggleDebugBtn) {
  toggleDebugBtn.addEventListener('click', () => {
    const panel = document.getElementById('debug-panel');
    const button = document.getElementById('toggle-debug');
    const headerBtn = document.querySelector('.btn-debug-toggle');
    
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      button.textContent = 'Hide';
      debugPanelVisible = true;
      updateDebugPanel();
      if (headerBtn) headerBtn.textContent = '🔍 Hide Debug';
    } else {
      panel.classList.add('hidden');
      button.textContent = 'Show Debug';
      debugPanelVisible = false;
      if (headerBtn) headerBtn.textContent = '🔍 Show Debug';
    }
  });
}

async function updateDebugPanel() {
  if (!currentSession) return;
  
  try {
    const response = await fetch(`${API_BASE}/conversation/${currentSession}/debug`);
    if (!response.ok) throw new Error('Failed to fetch debug info');
    
    const debug = await response.json();
    renderDebugPanel(debug);
  } catch (error) {
    console.error('Error fetching debug info:', error);
    const container = document.getElementById('debug-content');
    if (container) {
      container.innerHTML = `<p style="color: red;">Error loading debug info: ${error.message}</p>`;
    }
  }
}

function renderDebugPanel(debug) {
  const container = document.getElementById('debug-content');
  if (!container) return;
  
  // Add knowledge cache section if available
  let knowledgeSection = '';
  if (debug.knowledge_cache) {
    knowledgeSection = `
      <div class="debug-section">
        <h4>📚 Knowledge Cache</h4>
        <p><strong>Cache Size:</strong> ${debug.knowledge_cache.size} entries</p>
        <p><strong>Cache Expiry:</strong> ${debug.knowledge_cache.expiry === 0 ? 'Disabled (dev mode)' : `${debug.knowledge_cache.expiry / 1000}s`}</p>
        <p><strong>Cached Keys:</strong> ${debug.knowledge_cache.keys.length > 0 ? debug.knowledge_cache.keys.join(', ') : 'None'}</p>
        <button class="btn-clear-cache" onclick="clearKnowledgeCache()" style="margin-top: 10px; padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Clear Knowledge Cache
        </button>
      </div>
    `;
  }
  
  let html = `
    <div class="debug-section">
      <h4>📊 Progress Summary</h4>
      <p><strong>Overall Progress:</strong> ${debug.progress.percentage}% (${debug.questions_answered}/${debug.total_questions} questions answered)</p>
      <p><strong>Required Questions:</strong> ${debug.required_questions} total</p>
      <p><strong>Quality Score:</strong> ${debug.progress.quality_score || 'N/A'}%</p>
      <p><strong>Average Confidence:</strong> ${(debug.collected_data_summary.average_confidence * 100).toFixed(1)}%</p>
      <p><strong>Fields with Answers:</strong> ${debug.collected_data_summary.fields_with_answers}/${debug.collected_data_summary.total_fields}</p>
    </div>

    <div class="debug-section">
      <h4>❓ Questions Status</h4>
      <div class="questions-list">
        ${debug.question_status.map(q => `
          <div class="question-item ${q.answered ? 'answered' : 'missing'}">
            <div class="question-header">
              <span class="question-id">${q.question_id}</span>
              <span class="question-status">${q.answered ? '✓' : '✗'}</span>
              ${q.confidence > 0 ? `<span class="confidence-badge">${(q.confidence * 100).toFixed(0)}%</span>` : ''}
              ${q.required ? '<span class="required-badge">Required</span>' : ''}
            </div>
            <div class="question-text">${q.question_template}</div>
            ${q.answered ? `
              <div class="question-answer">
                <strong>Raw Answer:</strong> ${q.raw_answer ? `"${q.raw_answer.substring(0, 100)}${q.raw_answer.length > 100 ? '...' : ''}"` : 'N/A'}<br>
                <strong>Normalized:</strong> ${q.normalized_value || 'N/A'}
              </div>
            ` : '<div class="question-answer missing">Not answered yet</div>'}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="debug-section">
      <h4>📋 Component Unlock Analysis</h4>
      <div class="components-debug">
        ${debug.component_analysis.map(comp => `
          <div class="component-debug ${comp.status}">
            <div class="component-debug-header">
              <h5>${comp.component_name} <span class="status-badge ${comp.status}">${comp.status.toUpperCase()}</span></h5>
            </div>
            <div class="component-debug-requirements">
              <p><strong>Requirements:</strong></p>
              <ul>
                <li>Min questions: ${comp.requirements.min_questions_required}</li>
                <li>Min progress: ${comp.requirements.min_unlock_at_progress}%</li>
                <li>Required fields: ${comp.requirements.required_fields.length} (${comp.requirements.required_fields.join(', ')})</li>
                <li>Unlock questions: ${comp.requirements.unlock_after_question_ids.length} (${comp.requirements.unlock_after_question_ids.join(', ')})</li>
                ${Object.keys(comp.requirements.quality_checks).length > 0 ? `<li>Quality checks: ${Object.keys(comp.requirements.quality_checks).length}</li>` : ''}
              </ul>
            </div>
            <div class="component-debug-status">
              <p><strong>Current Status:</strong></p>
              <ul>
                <li>Fields present: ${comp.current_status.fields_present}/${comp.current_status.fields_total}</li>
                <li>Questions answered: ${comp.current_status.questions_answered}/${comp.current_status.questions_total}</li>
                <li>Questions met: ${comp.current_status.questions_met}/${comp.requirements.min_questions_required} (need ${comp.requirements.min_questions_required})</li>
                <li>Progress met: ${comp.current_status.progress_met ? '✓' : '✗'} (${debug.progress.percentage}% >= ${comp.requirements.min_unlock_at_progress}%)</li>
                <li>Quality passed: ${comp.current_status.quality_passed ? '✓' : '✗'}</li>
                <li><strong>Can unlock:</strong> <span style="color: ${comp.current_status.can_unlock ? '#28a745' : '#dc3545'}; font-weight: bold;">${comp.current_status.can_unlock ? '✓ YES' : '✗ NO'}</span></li>
              </ul>
            </div>
            ${comp.fields_status.length > 0 ? `
              <div class="component-debug-fields">
                <p><strong>Required Fields Status:</strong></p>
                <ul>
                  ${comp.fields_status.map(f => `
                    <li class="${f.present ? 'present' : 'missing'}">
                      <strong>${f.field_id}:</strong> ${f.present ? '✓' : '✗'} 
                      ${f.confidence > 0 ? `(${(f.confidence * 100).toFixed(0)}% confidence)` : ''}
                      ${f.raw_answer ? `<br><small style="color: #666;">Raw: "${f.raw_answer.substring(0, 60)}${f.raw_answer.length > 60 ? '...' : ''}"</small>` : ''}
                      ${f.normalized_value ? `<br><small style="color: #666;">Normalized: ${f.normalized_value}</small>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            ${comp.questions_status.length > 0 ? `
              <div class="component-debug-questions">
                <p><strong>Unlock Questions Status:</strong></p>
                <ul>
                  ${comp.questions_status.map(q => `
                    <li class="${q.present ? 'present' : 'missing'}">
                      <strong>${q.question_id}:</strong> ${q.present ? '✓' : '✗'}
                      ${q.confidence > 0 ? `(${(q.confidence * 100).toFixed(0)}% confidence)` : ''}
                      ${q.raw_answer ? `<br><small style="color: #666;">"${q.raw_answer.substring(0, 50)}${q.raw_answer.length > 50 ? '...' : ''}"</small>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            ${comp.quality_status.length > 0 ? `
              <div class="component-debug-quality">
                <p><strong>Quality Checks:</strong></p>
                <ul>
                  ${comp.quality_status.map(q => `
                    <li class="${q.passed ? 'passed' : 'failed'}">
                      <strong>${q.field_id}</strong> (${q.check_type}): ${q.passed ? '✓ PASSED' : '✗ FAILED'}
                      <br><small>Confidence: ${(q.confidence * 100).toFixed(0)}%, Words: ${q.word_count}</small>
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// Clear Knowledge Cache (global for onclick handlers)
window.clearKnowledgeCache = async function() {
  if (!confirm('Clear knowledge cache? This will force reload of all knowledge files on next request.')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/conversation/admin/knowledge/clear-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) throw new Error('Failed to clear cache');
    
    const data = await response.json();
    alert(`✅ ${data.message}\n\nCache stats: ${data.cache_stats.size} entries, ${data.cache_stats.expiry === 0 ? 'disabled' : `${data.cache_stats.expiry / 1000}s TTL`}`);
    
    // Refresh debug panel if open
    if (currentSession) {
      await updateDebugPanel();
    }
  } catch (error) {
    console.error('Error clearing knowledge cache:', error);
    alert(`Failed to clear cache: ${error.message}`);
  }
};

// Initialize on load
init();

