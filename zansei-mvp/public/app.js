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
  // For MVP, we only have brand_awareness
  const funnels = [
    {
      id: 'brand_awareness',
      label: '🔍 Nobody Knows About Us',
      description: 'People don\'t know my business exists'
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
    
    funnelSection.classList.add('hidden');
    conversationSection.classList.remove('hidden');
    
    // Add first message
    addMessage('assistant', data.first_message);
    updateProgress(data.progress);
    updateComponents(data.unlocked_components || []);
    
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
    updateProgress(data.progress);
    updateComponents(data.unlocked_components || []);
    
    // If conversation is complete, offer to generate report
    if (data.is_complete) {
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
function updateComponents(unlocked) {
  const container = document.getElementById('components-list');
  const components = [
    { id: 'content_strategy', name: '📝 Content Strategy', desc: 'What to post and when' },
    { id: 'channel_selection', name: '📱 Channel Selection', desc: 'Best platforms to reach your audience' },
    { id: 'local_visibility', name: '📍 Local Visibility', desc: 'Google Business Profile and local presence' },
    { id: 'budget_roi_tracking', name: '💰 Budget & ROI Tracking', desc: 'How to allocate and measure' },
    { id: 'quick_win_tactics', name: '⚡ Quick-Win Tactics', desc: 'Immediate actions to take' },
    { id: 'performance_metrics', name: '📊 Performance Metrics', desc: 'How to track success' }
  ];

  container.innerHTML = '';
  components.forEach(comp => {
    const card = document.createElement('div');
    card.className = `component-card ${unlocked.includes(comp.id) ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <h4>${comp.name}</h4>
      <p>${comp.desc}</p>
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

// New Conversation
document.getElementById('new-conversation-btn').addEventListener('click', () => {
  location.reload();
});

// Loading
function showLoading() {
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Initialize on load
init();

