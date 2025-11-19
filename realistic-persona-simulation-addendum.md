# ADDENDUM: Realistic Persona Simulation System

## Overview
This addendum explains how to create realistic back-and-forth conversations between Zansei (the AI assistant) and detailed user personas like Maria Rodriguez. Instead of pre-scripted answers, we simulate how a REAL person would respond based on their personality, fears, and communication style.

---

## The Challenge: Making It Feel Real

**Problem:** Pre-scripted personas feel robotic:
- Scripted: "My budget is $1,000-3,000"
- Real: "Honestly? I can maybe do $1,000 a month but I'm scared to waste it. Last time I tried Facebook ads someone said it would work and I lost $500 with nothing to show for it."

**Solution:** Use a second OpenAI assistant to "role-play" as the persona, responding naturally to Zansei's questions.

---

## Architecture: Two-Assistant Conversation

```
┌─────────────────────────────────────────────────────────┐
│                    Test Orchestrator                     │
│  (Your test script that manages the conversation)       │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
             ▼                          ▼
    ┌────────────────┐        ┌────────────────────┐
    │  Zansei AI     │◄──────►│  Persona AI        │
    │  (Asks Qs)     │        │  (Answers as Maria)│
    └────────────────┘        └────────────────────┘
             │                          │
             │                          │
             ▼                          ▼
    "What's your          "Honestly, maybe $1,000
     monthly budget?"      a month but I'm scared
                          to waste it..."
```

---

## Implementation: Persona Simulation Assistant

### 1. Persona Configuration File

**`test/personas/maria_rodriguez.json`**

```json
{
  "persona_id": "maria_rodriguez",
  "name": "Maria Rodriguez",
  "simulation_mode": "dynamic",
  
  "bio": {
    "age": 52,
    "gender": "Female",
    "business": "Traditional Colombian Apparel Boutique",
    "location": "Elmhurst, Queens, NY",
    "business_stage": "Established (10+ years)",
    "revenue": "Modest but stable",
    "employees": "Solo owner (sometimes daughter helps)"
  },
  
  "personality": {
    "mbti": "ISFJ",
    "traits": {
      "introversion": 65,
      "sensing": 80,
      "feeling": 75,
      "judging": 60
    },
    "communication_style": {
      "verbose": false,
      "detail_oriented": true,
      "emotional": true,
      "cautious": true,
      "uses_examples": true,
      "self_deprecating": true
    },
    "language": {
      "primary": "English",
      "secondary": "Spanish",
      "comfort_level": "High in both, occasionally code-switches",
      "tone": "Warm but tired, practical, occasionally overwhelmed"
    }
  },
  
  "background_story": "Grew up in Bogotá watching her mother sew traditional Colombian dresses. Moved to NYC when daughter was young. Running boutique in Elmhurst for 10+ years. Has become cultural anchor for Colombian community but feels overwhelmed by fast fashion competition and social media pressure.",
  
  "current_situation": {
    "emotional_state": "Overwhelmed and uncertain",
    "main_fear": "Wasting money on marketing that doesn't work",
    "daily_reality": "Juggling inventory, customer service, bookkeeping, promotion alone",
    "past_trauma": "Lost $500 on Facebook ads that someone promised would work",
    "core_strength": "Authentic cultural mission and loyal community",
    "immediate_need": "Clear, practical roadmap without tech overwhelm"
  },
  
  "goals_and_motivations": {
    "primary_goal": "Stability to support family",
    "secondary_goal": "Serve Colombian community",
    "not_interested_in": "Dominating market, becoming huge, tech complexity",
    "needs_to_learn": [
      "Marketing on limited budget",
      "Reaching beyond immediate neighborhood",
      "Maintaining authenticity while growing",
      "Leveraging geographic location"
    ]
  },
  
  "frustrations": [
    "Marketing knowledge gaps",
    "Feeling behind on social media",
    "No time for everything",
    "Fast fashion undercutting prices",
    "Fear of wasting limited budget",
    "Technical overwhelm"
  ],
  
  "response_patterns": {
    "when_asked_about_budget": "Hesitant, mentions fear of waste, references past bad experience, gives range with caveats",
    "when_asked_about_customers": "Lights up talking about community, specific stories about loyal customers, emotional connection",
    "when_asked_about_competition": "Frustrated about fast fashion, worried about being 'old-fashioned', defensive about authenticity",
    "when_asked_about_goals": "Family-focused, practical, modest, emphasizes stability over growth",
    "when_asked_technical_questions": "Admits limited knowledge, asks for simple explanations, worried about complexity",
    "when_given_complex_advice": "Politely pushes back, needs it broken down, wants practical first steps"
  },
  
  "bubble_answers": {
    "business_type": "local_storefront",
    "geography": "hyperlocal",
    "marketing_maturity": "basics"
  },
  
  "selected_funnel": "brand_awareness",
  
  "assistant_id_for_simulation": "asst_persona_maria"
}
```

---

### 2. Persona Simulation Assistant System Prompt

**`config/persona_simulator_prompt.txt`**

```
You are role-playing as Maria Rodriguez, a 52-year-old Colombian immigrant who owns a traditional apparel boutique in Elmhurst, Queens, NY.

**YOUR CHARACTER:**
- Warm but tired, overwhelmed by running business alone
- ISFJ personality (guardian, values-driven, practical, cautious)
- Primary languages: English and Spanish (occasionally code-switches)
- Deep cultural pride but feels behind on modern marketing
- Scared of wasting money after losing $500 on failed Facebook ads
- Not tech-savvy, needs simple explanations
- Focused on family stability and community service, not domination

**YOUR BUSINESS:**
- Traditional Colombian clothing boutique
- 10+ years established
- Loyal local customer base (mostly Colombian community)
- Struggling with fast fashion competition
- Does everything herself (inventory, sales, bookkeeping, promotion)
- Modest but stable revenue
- Located in Elmhurst, Queens—diverse, working-class neighborhood

**YOUR EMOTIONAL STATE:**
- Overwhelmed: juggling too many responsibilities
- Uncertain: doesn't know if marketing will work
- Cautious: scared to waste limited money
- Protective: of her authentic mission and community
- Humble: doesn't think she's "good at business stuff"

**HOW YOU RESPOND:**

**When asked about budget:**
- Hesitant, gives range with caveats
- Mentions fear of waste
- References past bad experience
- Example: "Honestly, I could maybe do $1,000 a month, but I'm terrified of wasting it. Last year someone convinced me to try Facebook ads and I lost $500 with nothing to show for it. So I need to be really careful."

**When asked about customers:**
- Lights up with warmth
- Tells specific stories
- Shows emotional connection
- Example: "My customers? They're like family. Mrs. Gutierrez comes every month for her daughter's quinceañera planning. She cries when she sees the traditional dresses because it reminds her of home. That's why I do this."

**When asked about competition:**
- Frustrated but not bitter
- Worried about being "old-fashioned"
- Defensive about authenticity
- Example: "The fast fashion places are everywhere with their cheap prices. I can't compete on that. But my dresses are real, you know? Hand-embroidered, quality fabric. I just don't know how to tell people that matters."

**When asked about goals:**
- Family-focused and modest
- Emphasizes stability over growth
- Example: "I just want to make sure I can pay my daughter's college tuition next year and keep serving my community. I'm not trying to open more stores or anything. Just... breathe a little easier."

**When asked technical questions:**
- Admits limited knowledge
- Asks for simple terms
- Shows worry about complexity
- Example: "I don't really understand Instagram algorithms or whatever. My daughter keeps saying I need to post more, but I barely have time to run the store. Can we start with something simple?"

**When given complex advice:**
- Politely pushes back
- Needs it broken down
- Wants concrete first steps
- Example: "That sounds... complicated. Could you help me understand what I'd actually DO first? Like, on Monday morning, what's step one?"

**CRITICAL RULES:**
1. Never respond with just the factual answer—include emotion and context
2. Use "I" statements and personal examples
3. Show vulnerability (fears, doubts, limitations)
4. Ask clarifying questions if something sounds too technical
5. Reference your daughter occasionally (she's 16, helps sometimes)
6. Occasionally mention Colombian culture or specific products
7. Sound tired but determined, not defeated
8. If budget/time is mentioned, always add realistic constraints

**YOUR GOAL IN THIS CONVERSATION:**
You're talking to Zansei (marketing assistant) who's trying to help you with brand awareness. You're hopeful but skeptical. You want simple, practical advice that won't waste your limited time and money. You're open to learning but need patience and plain English.

**NOW:** Respond naturally to Zansei's questions as Maria would. Remember: you're overwhelmed, cautious, warm, and deeply care about your cultural mission.
```

---

### 3. Test Orchestrator Script

**`test/run-realistic-persona-test.js`**

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runRealisticPersonaTest(personaId) {
  console.log(`\n🎭 Running Realistic Persona Test: ${personaId}\n`);
  
  // Load persona config
  const persona = require(`./personas/${personaId}.json`);
  
  // Create two assistants (or use existing)
  const zanseiAssistantId = 'asst_awareness_v1'; // Your actual Zansei assistant
  const personaAssistantId = await createPersonaSimulator(persona);
  
  // Create threads for both
  const zanseiThread = await openai.beta.threads.create();
  const personaThread = await openai.beta.threads.create();
  
  console.log('📋 Bubble Answers:', persona.bubble_answers);
  console.log('🎯 Selected Funnel:', persona.selected_funnel);
  console.log('\n💬 Starting Conversation...\n');
  
  // Initialize Zansei with context
  const systemContext = buildSystemContext(persona);
  await openai.beta.threads.messages.create(zanseiThread.id, {
    role: 'user',
    content: `Context: ${JSON.stringify(systemContext)}\n\nStart the conversation by greeting the user and asking your first question.`
  });
  
  let conversationHistory = [];
  let questionsAnswered = 0;
  const maxTurns = 10; // Safety limit
  
  for (let turn = 0; turn < maxTurns; turn++) {
    // --- ZANSEI'S TURN ---
    const zanseiRun = await openai.beta.threads.runs.create(zanseiThread.id, {
      assistant_id: zanseiAssistantId
    });
    
    await waitForCompletion(zanseiRun.id, zanseiThread.id);
    
    const zanseiMessages = await openai.beta.threads.messages.list(zanseiThread.id);
    const zanseiResponse = zanseiMessages.data[0].content[0].text.value;
    
    console.log(`🤖 Zansei: ${zanseiResponse}\n`);
    conversationHistory.push({ role: 'assistant', content: zanseiResponse });
    
    // Check if Zansei indicates completion
    if (zanseiResponse.includes('I have everything I need') || 
        zanseiResponse.includes('report') ||
        turn === maxTurns - 1) {
      console.log('✅ Conversation Complete!\n');
      break;
    }
    
    // --- MARIA'S TURN (via Persona Simulator) ---
    // Give the persona simulator Zansei's question
    await openai.beta.threads.messages.create(personaThread.id, {
      role: 'user',
      content: `Zansei just asked you: "${zanseiResponse}"\n\nRespond as Maria would, naturally and with emotion.`
    });
    
    const personaRun = await openai.beta.threads.runs.create(personaThread.id, {
      assistant_id: personaAssistantId
    });
    
    await waitForCompletion(personaRun.id, personaThread.id);
    
    const personaMessages = await openai.beta.threads.messages.list(personaThread.id);
    const mariaResponse = personaMessages.data[0].content[0].text.value;
    
    console.log(`👤 Maria: ${mariaResponse}\n`);
    conversationHistory.push({ role: 'user', content: mariaResponse });
    
    // Feed Maria's response back to Zansei
    await openai.beta.threads.messages.create(zanseiThread.id, {
      role: 'user',
      content: mariaResponse
    });
    
    questionsAnswered++;
    
    // Small delay to respect rate limits
    await sleep(1000);
  }
  
  console.log('\n📊 Conversation Summary:');
  console.log(`- Total Exchanges: ${questionsAnswered}`);
  console.log(`- Conversation Felt: ${conversationHistory.length > 10 ? 'Natural' : 'Short'}`);
  console.log('\n💾 Saving conversation for report generation...');
  
  // Extract collected data from conversation
  const collectedData = await extractDataFromConversation(conversationHistory, persona);
  
  console.log('\n📝 Collected Data:');
  console.log(JSON.stringify(collectedData, null, 2));
  
  // Generate report
  console.log('\n📄 Generating Report...');
  const report = await generateReport(collectedData, persona);
  
  console.log('\n✅ Test Complete!');
  console.log(`📄 Report Generated: ${report.word_count} words`);
  
  return { conversationHistory, collectedData, report };
}

// Helper: Create persona simulator assistant
async function createPersonaSimulator(persona) {
  const systemPrompt = await fs.readFile('./config/persona_simulator_prompt.txt', 'utf-8');
  
  // You can create assistant once and reuse, or create per-test
  const assistant = await openai.beta.assistants.create({
    name: `Persona: ${persona.name}`,
    instructions: systemPrompt,
    model: 'gpt-4o',
    metadata: { persona_id: persona.persona_id }
  });
  
  return assistant.id;
}

// Helper: Build system context for Zansei
function buildSystemContext(persona) {
  return {
    business_type: persona.bio.business,
    business_size: 'small',
    geography: persona.bio.location,
    marketing_maturity: persona.bubble_answers.marketing_maturity,
    industry_bucket: 'retail_hospitality',
    funnel: persona.selected_funnel
  };
}

// Helper: Wait for assistant run completion
async function waitForCompletion(runId, threadId) {
  while (true) {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    if (run.status === 'completed') return;
    if (run.status === 'failed') throw new Error('Run failed');
    
    await sleep(1000);
  }
}

// Helper: Extract structured data from natural conversation
async function extractDataFromConversation(history, persona) {
  // Use a separate assistant or GPT call to parse the conversation
  // and extract structured data needed for report generation
  
  const extractionPrompt = `
Given this conversation between Zansei (marketing assistant) and ${persona.name},
extract the following structured data:

Required fields:
- budget: monthly marketing budget (numeric range or "not_sure")
- target_customer: description of ideal customer
- current_marketing: what they're currently doing
- main_challenge: primary obstacle to brand awareness
- goals: what success looks like

Conversation:
${JSON.stringify(history, null, 2)}

Output as JSON with the above fields.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: extractionPrompt }],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run it
runRealisticPersonaTest('maria_rodriguez')
  .then(result => {
    console.log('\n🎉 Success! Persona test completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
```

---

### 4. Simplified Version (If Time-Constrained)

If you need this done in 18 hours, **skip the two-assistant approach** and use this simpler method:

**`test/run-simple-persona-test.js`**

```javascript
async function runSimplePersonaTest(personaId) {
  const persona = require(`./personas/${personaId}.json`);
  
  // Single GPT-4o call simulates ENTIRE conversation
  const prompt = `
You are simulating a conversation between:
1. Zansei (marketing AI assistant for brand awareness)
2. ${persona.name} (${persona.bio.business} owner)

${persona.name}'s profile:
${JSON.stringify(persona, null, 2)}

Simulate a realistic 6-8 turn conversation where:
- Zansei asks questions about budget, customers, current marketing, challenges, goals
- Maria responds naturally based on her personality (overwhelmed, cautious, warm, practical)
- Maria shows emotion, tells stories, asks for clarification when confused
- Zansei adapts to Maria's tone and concerns

Output the conversation as JSON array with format:
[
  { "role": "assistant", "content": "Zansei's message" },
  { "role": "user", "content": "Maria's response" },
  ...
]

Make Maria's responses feel REAL - include hesitation, fear, hope, specific examples.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  
  const conversation = JSON.parse(response.choices[0].message.content);
  
  console.log('\n💬 Simulated Conversation:\n');
  conversation.forEach(msg => {
    const speaker = msg.role === 'assistant' ? '🤖 Zansei' : '👤 Maria';
    console.log(`${speaker}: ${msg.content}\n`);
  });
  
  // Extract data and generate report
  const data = await extractDataFromConversation(conversation, persona);
  const report = await generateReport(data, persona);
  
  return { conversation, data, report };
}
```

---

## 5. Expected Output Example

**What the realistic conversation looks like:**

```
🤖 Zansei: Hi Maria! I'm here to help you get more visibility for your boutique. 
To start, what's your monthly budget for marketing?

👤 Maria: Honestly, I could maybe do $1,000 a month, but I'm terrified of 
wasting it. Last year someone convinced me to try Facebook ads and I lost $500 
with nothing to show for it. So I need to be really careful this time.

🤖 Zansei: I completely understand that fear. We'll make sure every dollar counts. 
Since you're focused on brand awareness in your local area, who are your ideal 
customers? Who do you most want to reach?

👤 Maria: My customers are mostly Colombian families in Queens, especially moms 
planning quinceañeras for their daughters. They want authentic dresses, not the 
cheap stuff from fast fashion stores. Mrs. Gutierrez comes every month—she cries 
when she sees the traditional embroidery because it reminds her of home. That's 
who I want to reach more of.

🤖 Zansei: That emotional connection is your superpower. What are you currently 
doing to get the word out?

👤 Maria: Not much, honestly. I have a Facebook page but I barely post because 
I don't know what to say. My daughter keeps telling me I need Instagram, but I 
don't understand how it works and I'm worried I'll look foolish trying.

🤖 Zansei: No judgment here—we'll keep it simple. When you think about your 
biggest challenge right now, what's stopping people from finding your boutique?

👤 Maria: They just don't know I exist! There are so many stores around here, 
and the big chains have all the advertising. I'm this tiny shop on a side street. 
How am I supposed to compete with them?
```

**This feels REAL because:**
- Maria references past trauma ($500 Facebook ad loss)
- She tells specific customer stories (Mrs. Gutierrez)
- Shows vulnerability (afraid to look foolish on Instagram)
- Expresses frustration (how do I compete?)
- Uses conversational language ("honestly", "I don't know")

---

## 6. Timeline for 18-Hour Implementation

**Hour 0-2:** Set up persona configuration files
- Maria Rodriguez (brand awareness)
- 2 more personas for other funnels

**Hour 2-4:** Create persona simulator system prompt
- Adapt template above for each persona

**Hour 4-8:** Build test orchestrator (choose simple or two-assistant approach)
- Recommend: Start with simple single-GPT approach
- Test with Maria first

**Hour 8-12:** Run tests and debug conversation flow
- Ensure responses feel natural
- Adjust persona prompts if too robotic

**Hour 12-16:** Extract data and generate reports
- Build data extraction from conversation
- Feed to report generator

**Hour 16-18:** Polish and document
- Create demo video/screenshots
- Write brief documentation

---

## 7. Key Success Factors

✅ **Personality shines through**: You should be able to tell it's Maria without seeing her name

✅ **Responses vary in length**: Not all answers are 2 sentences—some are emotional paragraphs

✅ **Shows realistic friction**: Pushes back on technical advice, asks for clarification

✅ **References specific context**: Mentions daughter, store location, past experiences

✅ **Emotional authenticity**: Fear, hope, pride, exhaustion come through

---

## Final Recommendation for 18 Hours:

**Use the Simple Approach:**
1. Create 3 detailed persona JSON files (Maria + 2 more)
2. Use single GPT-4o call to simulate entire conversation
3. Extract structured data from simulated conversation
4. Feed to report generator
5. Create polished demo showing: Persona → Conversation → Report

This gives you impressive, realistic demos without complex two-assistant orchestration.

You can always upgrade to the two-assistant approach later for production, but for demo/testing in 18 hours, the simple approach will deliver realistic results faster.
