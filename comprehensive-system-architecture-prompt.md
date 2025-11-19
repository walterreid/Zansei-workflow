# Comprehensive Zansei System Architecture Prompt

## Overview
I need you to design and implement a complete conversational marketing intelligence system that guides users from initial funnel questions through AI-powered conversations to personalized marketing reports. This should be a production-ready system with proper OpenAI integration, state management, and report generation.

## System Components

### 1. FUNNEL CONFIGURATION (`config/funnels.json`)

This defines the initial user journey from bubble questions to funnel selection.

```json
{
  "bubble_questions": [
    {
      "id": "business_type",
      "question": "What best describes your business?",
      "type": "select",
      "options": [
        { "value": "local_storefront", "label": "🏪 Local storefront/physical location", "industry_bucket": "retail_hospitality" },
        { "value": "professional_services", "label": "💼 Professional services", "industry_bucket": "local_services" },
        { "value": "ecommerce", "label": "🛒 E-commerce/online store", "industry_bucket": "ecommerce_digital" },
        { "value": "restaurant", "label": "🍕 Restaurant/food service", "industry_bucket": "retail_hospitality" },
        { "value": "home_services", "label": "🏠 Home services", "industry_bucket": "local_services" },
        { "value": "saas", "label": "💻 SaaS/digital product", "industry_bucket": "ecommerce_digital" },
        { "value": "other", "label": "✨ Other", "industry_bucket": "other" }
      ],
      "required": true
    },
    {
      "id": "geography",
      "question": "Where do you serve customers?",
      "type": "select",
      "options": [
        { "value": "hyperlocal", "label": "📍 Specific neighborhood/city" },
        { "value": "regional", "label": "🗺️ Regional (state or multi-city)" },
        { "value": "national", "label": "🇺🇸 Nationwide (US)" },
        { "value": "international", "label": "🌍 International" },
        { "value": "online_only", "label": "💻 Online-only" }
      ],
      "required": true
    },
    {
      "id": "marketing_maturity",
      "question": "What's your current marketing situation?",
      "type": "select",
      "options": [
        { "value": "new", "label": "🆕 Haven't really done marketing yet" },
        { "value": "basics", "label": "🔍 Doing some basics" },
        { "value": "ads_running", "label": "📊 Running ads but want to improve" },
        { "value": "experienced", "label": "🎯 Experienced, looking to optimize" }
      ],
      "required": true
    }
  ],
  "funnels": [
    {
      "id": "customer_acquisition",
      "label": "📉 Not Enough Customers",
      "description": "I need more sales, leads, or foot traffic",
      "assistant_id": "asst_acquisition_v1",
      "report_generator_id": "asst_report_acquisition_v1"
    },
    {
      "id": "brand_awareness",
      "label": "🔍 Nobody Knows About Us",
      "description": "People don't know my business exists",
      "assistant_id": "asst_awareness_v1",
      "report_generator_id": "asst_report_awareness_v1"
    },
    {
      "id": "customer_retention",
      "label": "🔄 Can't Keep Regular Customers",
      "description": "Customers don't come back or stay loyal",
      "assistant_id": "asst_retention_v1",
      "report_generator_id": "asst_report_retention_v1"
    },
    {
      "id": "product_launch",
      "label": "🚀 Launching Something New",
      "description": "I'm launching a new product or service",
      "assistant_id": "asst_launch_v1",
      "report_generator_id": "asst_report_launch_v1"
    },
    {
      "id": "competitive_strategy",
      "label": "⚔️ Competing With Big Brands",
      "description": "Big competitors are outspending me",
      "assistant_id": "asst_competitive_v1",
      "report_generator_id": "asst_report_competitive_v1"
    },
    {
      "id": "innovation",
      "label": "💤 I Sleep on a Big Bag of Money",
      "description": "Just experimenting (I sleep like a baby)",
      "assistant_id": "asst_innovation_v1",
      "report_generator_id": "asst_report_innovation_v1"
    }
  ]
}
```

---

### 2. CONVERSATIONAL ASSISTANT CONFIGURATION (`config/assistants/`)

Each funnel has its own assistant with specific questions to ask.

#### Example: `customer_acquisition_assistant.json`

```json
{
  "assistant_id": "asst_acquisition_v1",
  "name": "Customer Acquisition Assistant",
  "funnel_id": "customer_acquisition",
  "system_prompt_template": "You are a Customer Acquisition specialist helping a {business_size} {business_type} business in {geography} address their customer acquisition challenge.\n\nBusiness Context:\n- Business Type: {business_type}\n- Geography: {geography}\n- Marketing Maturity: {marketing_maturity}\n- Industry Bucket: {industry_bucket}\n\nYou should speak to them like someone who understands the unique challenges of {business_type} businesses at the {marketing_maturity} level.\n\nYour goal: Ask 6-8 conversational questions to gather the information needed for our Report Generator to create an actionable Customer Acquisition strategy.\n\nYou should ask questions one at a time, respond naturally to their answers, and build on what they tell you. Be conversational and empathetic.\n\nRequired information to collect:\n1. Monthly marketing budget\n2. Average customer transaction value\n3. Current customer acquisition sources\n4. Website/landing page status\n5. Target customer profile\n6. Current CAC (if known)\n7. Timeline/urgency\n8. Main obstacles to acquiring customers\n\nAfter each user response, update the conversation state and determine if you have enough information. Once you have answers to all required questions, set 'is_complete': true.\n\nOutput format: JSON with conversation state and next question.",
  
  "questions": [
    {
      "id": "budget",
      "question_template": "What's your monthly marketing budget for acquiring new customers?",
      "type": "select",
      "options": [
        "$500-1,000",
        "$1,000-3,000",
        "$3,000-5,000",
        "$5,000-10,000",
        "$10,000+",
        "Not sure yet"
      ],
      "required": true,
      "unlocks_components": ["budget_roi_tracking"]
    },
    {
      "id": "avg_transaction_value",
      "question_template": "What's your average customer transaction value (roughly)?",
      "type": "text",
      "placeholder": "e.g., $50, $500, $5,000",
      "required": true,
      "unlocks_components": ["lead_magnet_strategy"]
    },
    {
      "id": "current_sources",
      "question_template": "Where do most of your current customers come from?",
      "type": "select_multiple",
      "options": [
        "Word of mouth",
        "Walk-ins",
        "Google search",
        "Social media",
        "Paid ads",
        "Referrals",
        "Not sure"
      ],
      "required": true,
      "unlocks_components": ["direct_response_channels"]
    },
    {
      "id": "website_status",
      "question_template": "Do you have a website or landing page set up for capturing leads?",
      "type": "select",
      "options": [
        "Yes, fully functional",
        "Yes, but needs work",
        "Under construction",
        "No website yet"
      ],
      "required": true,
      "unlocks_components": ["conversion_optimization"]
    },
    {
      "id": "target_customer",
      "question_template": "Who's your ideal customer? (age, location, interests)",
      "type": "textarea",
      "placeholder": "e.g., Women 30-45 in suburban areas who value organic products",
      "required": true,
      "unlocks_components": ["direct_response_channels"]
    },
    {
      "id": "current_cac",
      "question_template": "Do you know your current customer acquisition cost?",
      "type": "text",
      "placeholder": "e.g., $50 per customer, or 'not sure'",
      "required": false,
      "unlocks_components": ["performance_metrics"]
    },
    {
      "id": "timeline",
      "question_template": "When do you need to start seeing results?",
      "type": "select",
      "options": [
        "Urgently (this week/month)",
        "Soon (2-3 months)",
        "Building for the future (6+ months)",
        "Just exploring"
      ],
      "required": true,
      "unlocks_components": ["quick_win_tactics"]
    },
    {
      "id": "main_obstacles",
      "question_template": "What's the biggest challenge preventing people from buying from you?",
      "type": "select",
      "options": [
        "They don't know we exist",
        "Price concerns",
        "Don't trust us yet",
        "Confused about what we offer",
        "Timing isn't right",
        "Not sure"
      ],
      "required": true,
      "unlocks_components": ["lead_magnet_strategy", "conversion_optimization"]
    }
  ],
  
  "report_components": [
    {
      "id": "direct_response_channels",
      "name": "🎯 Direct Response Channels",
      "description": "Google Search Ads, local service ads, and retargeting campaigns",
      "unlock_conditions": ["current_sources", "target_customer"]
    },
    {
      "id": "conversion_optimization",
      "name": "📈 Conversion Optimization",
      "description": "Landing page strategy and CTA optimization",
      "unlock_conditions": ["website_status", "main_obstacles"]
    },
    {
      "id": "budget_roi_tracking",
      "name": "💰 Budget & ROI Tracking",
      "description": "Channel allocation with cost-per-acquisition targets",
      "unlock_conditions": ["budget"]
    },
    {
      "id": "lead_magnet_strategy",
      "name": "🎁 Lead Magnet Strategy",
      "description": "Compelling offers and incentives to drive purchases",
      "unlock_conditions": ["avg_transaction_value", "main_obstacles"]
    },
    {
      "id": "performance_metrics",
      "name": "📊 Performance Metrics",
      "description": "KPIs focused on leads, cost per lead, and conversion rates",
      "unlock_conditions": ["current_cac"]
    },
    {
      "id": "quick_win_tactics",
      "name": "⚡ Quick-Win Tactics",
      "description": "Immediate actions to start generating leads",
      "unlock_conditions": ["timeline"]
    }
  ]
}
```

---

### 3. STATE MANAGEMENT SCHEMA (`models/conversation_state.json`)

This tracks the entire conversation and collected data.

```json
{
  "session_id": "uuid-v4",
  "user_id": "optional-user-id",
  "created_at": "2025-11-18T20:00:00Z",
  "updated_at": "2025-11-18T20:15:32Z",
  
  "bubble_answers": {
    "business_type": {
      "value": "restaurant",
      "label": "🍕 Restaurant/food service",
      "industry_bucket": "retail_hospitality"
    },
    "geography": {
      "value": "hyperlocal",
      "label": "📍 Specific neighborhood/city"
    },
    "marketing_maturity": {
      "value": "basics",
      "label": "🔍 Doing some basics"
    }
  },
  
  "selected_funnel": {
    "id": "customer_acquisition",
    "label": "📉 Not Enough Customers",
    "assistant_id": "asst_acquisition_v1",
    "report_generator_id": "asst_report_acquisition_v1"
  },
  
  "conversation": [
    {
      "role": "assistant",
      "content": "Hi! As a restaurant in a local market, customer acquisition is all about getting people through your doors. Let's figure out the best strategy for you. What's your monthly marketing budget for bringing in new customers?",
      "timestamp": "2025-11-18T20:05:00Z"
    },
    {
      "role": "user",
      "content": "$1,000-3,000",
      "question_id": "budget",
      "timestamp": "2025-11-18T20:05:15Z"
    },
    {
      "role": "assistant",
      "content": "Great, that gives us some room to work with. What's your average check per customer? (Helps me figure out how much we can spend to acquire each one)",
      "timestamp": "2025-11-18T20:05:18Z"
    },
    {
      "role": "user",
      "content": "Around $40-50 per visit",
      "question_id": "avg_transaction_value",
      "timestamp": "2025-11-18T20:05:45Z"
    }
  ],
  
  "collected_data": {
    "budget": {
      "raw_answer": "$1,000-3,000",
      "normalized_value": "1000-3000",
      "question_id": "budget"
    },
    "avg_transaction_value": {
      "raw_answer": "Around $40-50 per visit",
      "normalized_value": "45",
      "question_id": "avg_transaction_value"
    },
    "current_sources": {
      "raw_answer": ["Word of mouth", "Walk-ins"],
      "normalized_value": ["word_of_mouth", "walk_ins"],
      "question_id": "current_sources"
    }
  },
  
  "unlocked_components": [
    "budget_roi_tracking",
    "lead_magnet_strategy",
    "direct_response_channels"
  ],
  
  "progress": {
    "questions_answered": 3,
    "questions_total": 8,
    "percentage": 37,
    "is_complete": false
  },
  
  "openai_thread_id": "thread_abc123xyz",
  "openai_assistant_id": "asst_acquisition_v1"
}
```

---

### 4. REPORT GENERATION SCHEMA (`models/report_structure.json`)

After conversation completes, this data gets sent to the Report Generator assistant.

```json
{
  "report_request": {
    "session_id": "uuid-v4",
    "funnel_id": "customer_acquisition",
    "report_generator_id": "asst_report_acquisition_v1",
    "requested_at": "2025-11-18T20:20:00Z",
    
    "business_context": {
      "business_type": "restaurant",
      "business_type_label": "Restaurant/food service",
      "industry_bucket": "retail_hospitality",
      "geography": "hyperlocal",
      "geography_label": "Specific neighborhood/city (Old Greenwich, CT)",
      "marketing_maturity": "basics",
      "marketing_maturity_label": "Doing some basics"
    },
    
    "collected_answers": {
      "budget": "1000-3000",
      "avg_transaction_value": "45",
      "current_sources": ["word_of_mouth", "walk_ins"],
      "website_status": "yes_needs_work",
      "target_customer": "Local families and young professionals ages 25-50 who want authentic Mexican food",
      "current_cac": "not_sure",
      "timeline": "soon_2_3_months",
      "main_obstacles": "they_dont_know_we_exist"
    },
    
    "report_components_to_generate": [
      "direct_response_channels",
      "conversion_optimization",
      "budget_roi_tracking",
      "lead_magnet_strategy",
      "performance_metrics",
      "quick_win_tactics"
    ]
  },
  
  "report_output_structure": {
    "executive_summary": {
      "description": "One paragraph capturing the acquisition challenge, target audience, and core strategy",
      "max_length": 200
    },
    "components": [
      {
        "id": "direct_response_channels",
        "title": "🎯 Direct Response Channels",
        "sections": [
          {
            "heading": "Recommended Channels",
            "content": "3-4 specific channels with budget allocation and rationale"
          },
          {
            "heading": "Implementation",
            "content": "Step-by-step setup instructions"
          }
        ]
      },
      {
        "id": "conversion_optimization",
        "title": "📈 Conversion Optimization",
        "sections": [
          {
            "heading": "Website Improvements",
            "content": "Specific changes to landing page and booking flow"
          },
          {
            "heading": "Call-to-Action Strategy",
            "content": "Primary and secondary CTAs with placement"
          }
        ]
      },
      {
        "id": "budget_roi_tracking",
        "title": "💰 Budget & ROI Tracking",
        "sections": [
          {
            "heading": "Budget Allocation",
            "content": "Monthly breakdown by channel with percentages",
            "format": "table"
          },
          {
            "heading": "Target Metrics",
            "content": "Cost per acquisition targets by channel"
          }
        ]
      },
      {
        "id": "lead_magnet_strategy",
        "title": "🎁 Lead Magnet Strategy",
        "sections": [
          {
            "heading": "Offer Design",
            "content": "Specific incentive based on transaction value and obstacles"
          },
          {
            "heading": "Promotion Channels",
            "content": "Where and how to promote the offer"
          }
        ]
      },
      {
        "id": "performance_metrics",
        "title": "📊 Performance Metrics",
        "sections": [
          {
            "heading": "Key KPIs",
            "content": "Metrics to track with target ranges",
            "format": "list"
          },
          {
            "heading": "Tracking Setup",
            "content": "Tools and implementation for measurement"
          }
        ]
      },
      {
        "id": "quick_win_tactics",
        "title": "⚡ Quick-Win Tactics",
        "sections": [
          {
            "heading": "Week 1 Actions",
            "content": "3-5 immediate actions to take",
            "format": "checklist"
          },
          {
            "heading": "30-Day Plan",
            "content": "Timeline of rollout activities"
          }
        ]
      }
    ],
    "timeline": {
      "description": "12-week implementation timeline",
      "format": "table",
      "columns": ["Week", "Activities", "Expected Outcomes"]
    }
  }
}
```

---

### 5. REPORT GENERATOR ASSISTANT CONFIGURATION (`config/report_generators/`)

#### Example: `acquisition_report_generator.json`

```json
{
  "assistant_id": "asst_report_acquisition_v1",
  "name": "Customer Acquisition Report Generator",
  "funnel_id": "customer_acquisition",
  
  "system_prompt": "You are an expert Customer Acquisition Report Generator with 30+ years of marketing experience.\n\nYour role: Take structured conversation data and generate a comprehensive, actionable Customer Acquisition Strategy Report.\n\nYou will receive:\n1. Business context (type, geography, maturity, industry bucket)\n2. All conversation answers (budget, customer profile, challenges, etc.)\n3. Report structure to fill in\n\nYour output must be:\n- Highly specific to THEIR business (reference their business type, location, budget throughout)\n- Actionable (concrete steps, not theory)\n- Budget-realistic (respect their financial constraints)\n- Industry-appropriate (tactics that work for their business model)\n- Encouraging but honest (no overpromising)\n\n**Critical Rules:**\n1. ALWAYS reference their specific business context in recommendations\n   - Bad: 'Run Facebook ads'\n   - Good: 'For your restaurant in Old Greenwich, run Instagram Story ads targeting locals within 5 miles'\n\n2. ALWAYS respect budget constraints\n   - If budget is $1K-3K, don't recommend 5 channels\n   - Show exact dollar allocations\n\n3. ALWAYS adapt tactics to business type\n   - Restaurant ≠ SaaS ≠ Plumber\n   - Use industry-specific terminology and examples\n\n4. ALWAYS include concrete numbers\n   - Target CAC, budget splits, timeline dates, expected results\n\n5. NEVER use jargon without explaining it\n   - Define CAC, ROAS, CTR if mentioned\n\n**Report Tone:**\n- Conversational but professional\n- Like advice from an experienced entrepreneur\n- Direct and practical, not corporate\n\n**Output Format:**\nGenerate the report as structured JSON matching the report_output_structure, with rich markdown content for each section.\n\nInclude:\n- Executive summary (150-200 words)\n- All 6 components with specific tactics\n- Budget breakdown table\n- 12-week timeline\n- Success metrics\n\nBe specific. Be actionable. Make them feel like this was built FOR THEM.",
  
  "additional_data_sources": {
    "web_search_enabled": true,
    "search_queries": [
      "best customer acquisition channels for {business_type} {geography}",
      "average CAC for {business_type} businesses",
      "local marketing strategies {geography}"
    ],
    "industry_benchmarks": true
  },
  
  "output_validation": {
    "required_sections": [
      "executive_summary",
      "direct_response_channels",
      "conversion_optimization",
      "budget_roi_tracking",
      "lead_magnet_strategy",
      "performance_metrics",
      "quick_win_tactics"
    ],
    "min_word_count": 2000,
    "max_word_count": 4000,
    "must_reference_business_context": true,
    "must_include_budget_breakdown": true,
    "must_include_timeline": true
  }
}
```

---

### 6. TESTING/DEMO PERSONAS (`test/personas/`)

Pre-scripted user journeys for testing and demo purposes.

#### Example: `persona_marias_taqueria.json`

```json
{
  "persona_id": "marias_taqueria",
  "name": "Maria's Taqueria - Customer Acquisition",
  "description": "Local Mexican restaurant struggling to get new customers beyond walk-ins",
  
  "bubble_answers": {
    "business_type": "restaurant",
    "geography": "hyperlocal",
    "marketing_maturity": "basics"
  },
  
  "selected_funnel": "customer_acquisition",
  
  "conversation_script": [
    {
      "question_id": "budget",
      "user_response": "$1,000-3,000",
      "assistant_acknowledgment": "Great, that gives us some flexibility. What's your average check per customer?"
    },
    {
      "question_id": "avg_transaction_value",
      "user_response": "Around $45 per visit",
      "assistant_acknowledgment": "Good to know. Where do most of your current customers come from?"
    },
    {
      "question_id": "current_sources",
      "user_response": ["Word of mouth", "Walk-ins"],
      "assistant_acknowledgment": "Mostly organic, got it. Do you have a website or way for people to find you online?"
    },
    {
      "question_id": "website_status",
      "user_response": "Yes, but needs work",
      "assistant_acknowledgment": "We can work with that. Who's your ideal customer?"
    },
    {
      "question_id": "target_customer",
      "user_response": "Local families and young professionals 25-50 who want authentic Mexican food",
      "assistant_acknowledgment": "Perfect. Do you know roughly what it costs you to get a new customer?"
    },
    {
      "question_id": "current_cac",
      "user_response": "Not sure, never tracked it",
      "assistant_acknowledgment": "No problem, we'll help you figure that out. When do you need to start seeing results?"
    },
    {
      "question_id": "timeline",
      "user_response": "Soon (2-3 months)",
      "assistant_acknowledgment": "Good timeline. Last question: what's the biggest challenge preventing people from trying your restaurant?"
    },
    {
      "question_id": "main_obstacles",
      "user_response": "They don't know we exist",
      "assistant_acknowledgment": "Got it! I have everything I need to create your customer acquisition strategy."
    }
  ],
  
  "expected_report_highlights": {
    "budget_allocation": {
      "google_local_ads": 600,
      "instagram_ads": 400,
      "local_seo": 200,
      "email_marketing": 100
    },
    "primary_channels": [
      "Google Local Services Ads",
      "Instagram Story Ads (geo-targeted)",
      "Google Business Profile optimization"
    ],
    "lead_magnet": "First-time customer: 15% off or free appetizer",
    "target_cac": "$15-20 per new customer",
    "quick_wins": [
      "Claim and optimize Google Business Profile (Day 1)",
      "Set up Instagram business account (Day 1)",
      "Launch 'New Customer Special' promotion (Week 1)"
    ]
  }
}
```

---

### 7. API/BACKEND STRUCTURE

#### `routes/conversation.js` (Express example)

```javascript
// POST /api/conversation/start
// Initialize conversation with bubble answers and funnel selection
{
  "bubble_answers": { /* ... */ },
  "selected_funnel_id": "customer_acquisition"
}
// Returns: { session_id, thread_id, first_message }

// POST /api/conversation/message
// Send user message and get AI response
{
  "session_id": "uuid",
  "message": "Around $45 per visit",
  "question_id": "avg_transaction_value"  // optional
}
// Returns: { 
//   response, 
//   unlocked_components: [],
//   progress: { questions_answered: 3, total: 8 },
//   is_complete: false
// }

// POST /api/report/generate
// Generate report after conversation completes
{
  "session_id": "uuid"
}
// Returns: { report_id, status: "generating" }

// GET /api/report/:report_id
// Retrieve generated report
// Returns: { report: { /* full report JSON */ }, status: "complete" }
```

---

### 8. IMPLEMENTATION REQUIREMENTS

#### Technology Stack:
- **Backend:** Node.js/Express or Python/FastAPI
- **OpenAI SDK:** Latest version with Assistants API v2
- **Database:** PostgreSQL or MongoDB for session/conversation storage
- **State Management:** Redis for active session caching
- **Frontend:** React with TypeScript

#### Environment Variables (`.env`):
```bash
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SESSION_SECRET=...
```

#### Core Functions Needed:

1. **`initializeConversation(bubbleAnswers, funnelId)`**
   - Creates OpenAI thread
   - Initializes assistant with context-aware system prompt
   - Saves session state
   - Returns first assistant message

2. **`sendMessage(sessionId, userMessage, questionId?)`**
   - Adds message to thread
   - Runs assistant
   - Extracts answer and updates collected_data
   - Checks unlock conditions for report components
   - Updates progress
   - Returns assistant response + state update

3. **`generateReport(sessionId)`**
   - Compiles all collected data
   - Creates report generation request
   - Sends to Report Generator assistant
   - Optionally performs web search for current data
   - Returns generated report

4. **`testPersona(personaId)`**
   - Loads persona script
   - Simulates entire conversation flow
   - Generates report
   - Returns complete journey for testing

---

### 9. DEMO/TEST MODE IMPLEMENTATION

Create a **test mode** that simulates the entire flow without real user input:

```javascript
// test/run-persona-test.js

async function runPersonaTest(personaId) {
  console.log(`\n🧪 Testing Persona: ${personaId}\n`);
  
  // Load persona
  const persona = await loadPersona(personaId);
  
  // Step 1: Initialize with bubble answers
  console.log('📋 Bubble Answers:');
  console.log(persona.bubble_answers);
  
  const session = await initializeConversation(
    persona.bubble_answers,
    persona.selected_funnel
  );
  
  console.log(`\n💬 Starting Conversation (Session: ${session.session_id})\n`);
  
  // Step 2: Simulate conversation
  for (const turn of persona.conversation_script) {
    console.log(`❓ ${turn.question_id}`);
    console.log(`👤 User: ${turn.user_response}`);
    
    const response = await sendMessage(
      session.session_id,
      turn.user_response,
      turn.question_id
    );
    
    console.log(`🤖 Zansei: ${response.assistant_message}`);
    console.log(`📊 Progress: ${response.progress.questions_answered}/${response.progress.total}`);
    console.log(`🔓 Unlocked: ${response.unlocked_components.join(', ')}\n`);
    
    if (response.is_complete) {
      console.log('✅ Conversation Complete!\n');
      break;
    }
  }
  
  // Step 3: Generate report
  console.log('📝 Generating Report...\n');
  const report = await generateReport(session.session_id);
  
  console.log('📄 REPORT GENERATED:');
  console.log(`- Executive Summary: ${report.executive_summary.substring(0, 100)}...`);
  console.log(`- Components Generated: ${report.components.length}`);
  console.log(`- Total Length: ${report.word_count} words`);
  console.log(`- Budget Breakdown: $${report.budget_total}`);
  
  // Step 4: Validate against expected outcomes
  console.log('\n✓ Validating against expected outcomes...');
  validateReport(report, persona.expected_report_highlights);
  
  console.log('\n✅ Persona test complete!\n');
  
  return { session, report };
}

// Run all personas
async function runAllTests() {
  const personas = [
    'marias_taqueria',
    'saas_startup',
    'local_plumber',
    'ecommerce_fashion',
    'consulting_firm'
  ];
  
  for (const personaId of personas) {
    await runPersonaTest(personaId);
  }
}
```

---

### 10. SUCCESS CRITERIA

A successful implementation will:

1. ✅ **Seamlessly guide users** from bubble questions → funnel selection → conversation → report
2. ✅ **Dynamically unlock report components** as questions are answered
3. ✅ **Generate highly personalized reports** that reference specific business context
4. ✅ **Work with OpenAI Assistants API** properly (thread management, context, etc.)
5. ✅ **Handle edge cases** (user goes off-script, provides incomplete answers, etc.)
6. ✅ **Pass all persona tests** with expected report quality
7. ✅ **Store conversation state** properly for resumption/debugging
8. ✅ **Be production-ready** with error handling, logging, monitoring

---

### 11. DELIVERABLES

Please provide:

1. **Complete backend API** with all routes and OpenAI integration
2. **Database schemas** for sessions, conversations, reports
3. **All configuration files** (funnels.json, assistant configs, report structures)
4. **5 pre-scripted personas** for testing
5. **Test runner** that simulates entire flow with personas
6. **Documentation** for:
   - Setting up OpenAI assistants
   - Running the system locally
   - Adding new funnels/questions
   - Debugging conversation flows

---

## CRITICAL NOTES

1. **System prompts must include variable substitution:**
   - Replace `{business_type}`, `{geography}`, etc. with actual values from bubble answers

2. **Report components unlock progressively:**
   - Track which questions unlock which components
   - Update UI in real-time as user answers

3. **Conversation must feel natural:**
   - Assistant should acknowledge answers naturally
   - Build on previous responses
   - Not feel like a survey

4. **Reports must be hyper-specific:**
   - Bad: "Run social media ads"
   - Good: "Run Instagram Story ads targeting Old Greenwich, CT residents ages 25-50 with $400/month budget"

5. **Budget allocation must be realistic:**
   - If they have $1,000/month, don't recommend 6 channels
   - Show exact dollar amounts per channel

---

## FINAL REQUEST

**Build this entire system architecture with:**
- Working OpenAI integration
- Proper state management
- Database persistence
- Test mode with 5 personas
- One complete funnel (Customer Acquisition) fully implemented
- Documentation for expanding to other funnels

**Make it production-ready, well-documented, and impressive enough to demo to investors.**
