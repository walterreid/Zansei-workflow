# Zansei MVP - Conversational Marketing Intelligence System

A production-ready conversational AI marketing assistant that guides small business owners from initial questions through personalized strategy reports.

## Overview

Zansei helps small business owners identify their marketing challenges and generates hyper-personalized marketing strategy reports through natural conversation. Unlike generic marketing tools, Zansei creates reports that reference the user's specific business context, budget, and challenges.

## Features

- **Conversational Interface**: Natural back-and-forth conversation (not a form)
- **Progressive Component Unlocking**: Report components unlock as questions are answered with quality checks
- **Hyper-Personalized Reports**: Reports reference specific business context, location, and budget
- **Interactive Report Generation**: Click unlocked components to generate beautiful HTML reports
- **Upgrade Flow**: Click locked components to answer targeted questions and unlock them
- **AI-Native Data Extraction**: Uses OpenAI structured outputs - no regex, fully flexible and maintainable
- **6 Marketing Funnels**: Customer Acquisition, Brand Awareness, Customer Retention, Product Launch, Competitive Strategy, and Innovation
- **Smart 10 Questions**: 6 universal questions + 4 funnel-specific questions for comprehensive data collection
- **Persona Testing**: Realistic persona simulation for testing and demos
- **Web UI**: Simple, clean interface showing conversation, component unlocking, and debug panel

## Tech Stack

- **Backend**: Node.js/Express
- **AI**: OpenAI Assistants API v2 (GPT-4o)
- **Database**: SQLite (easy setup, no external dependencies)
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd zansei-mvp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```bash
   OPENAI_API_KEY=sk-your-actual-api-key-here
   DATABASE_PATH=./data/zansei.db
   PORT=3000
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3002`

## Usage

### Web Interface

1. **Answer Bubble Questions**: Select your business type, geography, and marketing maturity
2. **Select Your Challenge**: Choose from 6 marketing funnels (e.g., "Nobody Knows About Us" for Brand Awareness)
3. **Have a Conversation**: Answer Zansei's questions naturally (Zansei will ask for your name first)
4. **Watch Components Unlock**: See report components light up as you answer with sufficient detail
5. **Generate Individual Reports**: Click any unlocked component to generate a beautiful HTML report
6. **Upgrade Locked Components**: Click "Answer Questions to Unlock" on partial/locked components to answer targeted follow-up questions
7. **Debug Panel**: Click "🔍 Show Debug" to see extracted data, progress calculation, and unlock logic

### Persona Testing

Test the system with the Maria Rodriguez persona:

```bash
npm run test:persona maria_rodriguez
```

This will:
- Simulate a realistic conversation between Zansei and Maria
- Show progress and component unlocking
- Generate a complete report
- Save the report to `test-outputs/`

### Updating Assistants

To update all assistants with the latest configs (useful after modifying system prompts):

```bash
npm run update-assistants
```

This will:
- Force-update all assistants with latest instructions
- Create any missing assistants
- Verify that assistants have correct instructions

## Project Structure

```
zansei-mvp/
├── config/
│   ├── funnels.json                          # Funnel definitions
│   ├── assistants/
│   │   └── brand_awareness_assistant.json    # Conversation assistant config
│   └── report_generators/
│       └── brand_awareness_report.json        # Report generator config
├── test/
│   ├── personas/
│   │   └── maria_rodriguez.json              # Maria persona definition
│   └── run-persona-test.js                   # Persona test runner
├── src/
│   ├── models/
│   │   ├── database.js                       # SQLite setup
│   │   ├── conversation.model.js              # Conversation data access
│   │   └── report.model.js                   # Report data access
│   ├── services/
│   │   ├── openai.service.js                  # OpenAI API integration
│   │   ├── conversation.service.js            # Conversation flow logic
│   │   └── report.service.js                 # Report generation logic
│   ├── routes/
│   │   ├── conversation.routes.js             # Conversation API endpoints
│   │   └── report.routes.js                  # Report API endpoints
│   ├── utils/
│   │   ├── promptBuilder.js                  # System prompt building
│   │   ├── schemaBuilder.js                  # Dynamic JSON schema generation for AI extraction
│   │   └── dataExtractor.js                  # Component unlock logic and quality assessment
│   └── server.js                             # Express server setup
├── public/
│   ├── index.html                             # Web UI
│   ├── style.css                              # Styling
│   └── app.js                                 # Frontend logic
├── data/                                      # SQLite database (created automatically)
├── .env                                       # Environment variables (create from .env.example)
└── package.json
```

## API Endpoints

### Conversation

- `POST /api/conversation/start` - Initialize a new conversation
  ```json
  {
    "bubble_answers": {
      "business_type": { "value": "local_storefront" },
      "geography": { "value": "hyperlocal" },
      "marketing_maturity": { "value": "basics" }
    },
    "selected_funnel_id": "brand_awareness"
  }
  ```

- `POST /api/conversation/message` - Send a message
  ```json
  {
    "session_id": "uuid",
    "message": "User's message here"
  }
  ```

- `GET /api/conversation/:sessionId` - Get conversation state
- `GET /api/conversation/:sessionId/debug` - Get debug information (extracted data, progress, unlock logic)
- `POST /api/conversation/upgrade-component` - Start upgrade flow for a locked component
  ```json
  {
    "session_id": "uuid",
    "component_id": "quick_wins"
  }
  ```

### Reports

- `POST /api/report/generate-html/:componentId` - Generate HTML report for a specific component
  ```json
  {
    "session_id": "uuid"
  }
  ```
  Returns: `{ view_url: "/api/report/view/filename.html", download_url: "/api/report/download/filename.html" }`

- `GET /api/report/view/:filename` - View generated HTML report
- `GET /api/report/download/:filename` - Download generated HTML report
- `POST /api/report/generate` - Generate full report (legacy endpoint)
- `GET /api/report/:reportId` - Get generated report
- `GET /api/report/session/:sessionId` - Get report by session

## OpenAI Assistant Setup

The system automatically creates and manages 12 OpenAI assistants on startup (6 conversation assistants + 6 report generators):

1. **Customer Acquisition** - Conversation assistant + Report generator
2. **Brand Awareness** - Conversation assistant + Report generator
3. **Customer Retention** - Conversation assistant + Report generator
4. **Product Launch** - Conversation assistant + Report generator
5. **Competitive Strategy** - Conversation assistant + Report generator
6. **Innovation/Experimentation** - Conversation assistant + Report generator

### Assistant Management

**Automatic Updates**: The system automatically updates assistant instructions if they've changed in the config files.

**Manual Update Script**: To force-update all assistants with latest configs:
```bash
npm run update-assistants
```

This will:
- Update all existing assistants with latest system prompts
- Create any missing assistants
- Verify that assistants have the correct instructions

**Reusing Existing Assistants**: The system automatically reuses assistants by name if they already exist, preventing duplicate creation.

## Configuration

### Adding New Funnels

1. Add funnel definition to `config/funnels.json`
2. Create assistant config in `config/assistants/[funnel_id]_assistant.json`
3. Create report generator config in `config/report_generators/[funnel_id]_report.json`
4. Update `src/services/openai.service.js` to initialize new assistants

### Customizing Questions

Edit any assistant config in `config/assistants/[funnel_id]_assistant.json`:
- Modify `questions` array to add/remove questions
- Update `report_components` to define unlock conditions
- Adjust `system_prompt_template` for conversation style

**Note**: The AI-native extraction system automatically generates JSON schemas from your question configs. No code changes needed when adding new question types - just update the config!

### Customizing Report Structure

Edit `config/report_generators/brand_awareness_report.json`:
- Modify `system_prompt` for report generation style
- Update `output_validation` requirements

## Persona Testing

### Creating New Personas

1. Create a new JSON file in `test/personas/`
2. Follow the structure of `maria_rodriguez.json`:
   - `bio` - Business and personal details
   - `personality` - Communication style and traits
   - `response_patterns` - How they respond to different questions
   - `bubble_answers` - Initial bubble question answers
   - `selected_funnel` - Which funnel they're testing

3. Run the test:
   ```bash
   npm run test:persona your_persona_id
   ```

## Troubleshooting

### "Assistant not initialized" Error

- Make sure `OPENAI_API_KEY` is set in `.env`
- Check that assistants were created on startup (check server logs)
- Verify your OpenAI API key is valid

### Database Errors

- Ensure the `data/` directory exists and is writable
- Delete `data/zansei.db` to reset the database
- Check file permissions

### Conversation Not Progressing

- Check browser console for API errors
- Verify the server is running on the correct port
- Check that OpenAI API calls are succeeding (check server logs)

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` to auto-reload on file changes.

### Database Schema

The SQLite database has four main tables:
- `sessions` - Conversation sessions
- `conversations` - Message history
- `collected_data` - Extracted answers
- `reports` - Generated reports

See `src/models/database.js` for schema details.

## AI-Native Data Extraction

Zansei uses a fully AI-native approach for extracting structured data from conversations:

### How It Works

1. **Dynamic Schema Generation**: The `schemaBuilder.js` utility generates JSON schemas from your assistant configs
2. **Structured Outputs**: Uses OpenAI's structured outputs feature to ensure reliable, validated extraction
3. **Intelligent Normalization**: AI understands context and normalizes answers intelligently (e.g., "1k" → "$1,000-3,000")
4. **Confidence Scoring**: Each extracted answer includes a confidence score (0.0-1.0) for quality assessment
5. **Context Extraction**: Captures implicit information like timeline, constraints, and emotional state

### Benefits

- **No Regex**: All extraction is AI-driven - no hardcoded patterns to maintain
- **Flexible**: Schema changes automatically when you update question configs
- **Maintainable**: No code changes needed when adding new question types
- **Intelligent**: AI understands nuance and context, not just pattern matching
- **Robust**: Handles edge cases naturally

### Example

User says: "Well right now 0, but I would like to scale... so maybe 1k but we'd need to start after the new year"

AI extracts:
```json
{
  "budget": {
    "raw_answer": "Well right now 0, but I would like to scale... so maybe 1k",
    "normalized_value": "$1,000-3,000",
    "confidence": 0.75,
    "extracted_context": {
      "timeline": "after_new_year",
      "current_budget": "$0"
    }
  }
}
```

## Recent Updates

- ✅ **Interactive Report Generation**: Click unlocked components to generate beautiful HTML reports
- ✅ **Upgrade Flow**: Answer targeted questions to unlock specific report components
- ✅ **Debug Panel**: Visualize extracted data, progress calculation, and component unlock logic
- ✅ **AI-Native Extraction**: Fully refactored to use OpenAI structured outputs (no regex)
- ✅ **All 6 Funnels**: Complete implementation of all marketing funnels
- ✅ **Smart 10 Questions**: Universal + funnel-specific question strategy
- ✅ **Component Quality Checks**: Reports only unlock when answers meet quality thresholds

## Future Enhancements

- [ ] Add user authentication
- [ ] Implement Redis for session caching
- [ ] Add report export (PDF, DOCX)
- [ ] Add more personas for testing
- [ ] Implement two-assistant persona simulation
- [ ] Add conversation resumption
- [ ] Add report sharing/email
- [ ] Add report comparison (before/after upgrade)

## License

ISC

## Support

For issues or questions, please check the troubleshooting section or review the code comments.

---

**Built with ❤️ for small business owners who feel invisible**

