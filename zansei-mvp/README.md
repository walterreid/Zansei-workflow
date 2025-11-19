# Zansei MVP - Conversational Marketing Intelligence System

A production-ready conversational AI marketing assistant that guides small business owners from initial questions through personalized strategy reports.

## Overview

Zansei helps small business owners identify their marketing challenges and generates hyper-personalized marketing strategy reports through natural conversation. Unlike generic marketing tools, Zansei creates reports that reference the user's specific business context, budget, and challenges.

## Features

- **Conversational Interface**: Natural back-and-forth conversation (not a form)
- **Progressive Component Unlocking**: Report components unlock as questions are answered
- **Hyper-Personalized Reports**: Reports reference specific business context, location, and budget
- **Brand Awareness Funnel**: Complete implementation for brand awareness challenges
- **Persona Testing**: Realistic persona simulation for testing and demos
- **Web UI**: Simple, clean interface showing conversation and component unlocking

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
   Navigate to `http://localhost:3000`

## Usage

### Web Interface

1. **Answer Bubble Questions**: Select your business type, geography, and marketing maturity
2. **Select Your Challenge**: Choose "Nobody Knows About Us" (Brand Awareness)
3. **Have a Conversation**: Answer Zansei's questions naturally
4. **Watch Components Unlock**: See report components light up as you answer
5. **Generate Report**: Once complete, generate your personalized strategy report

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
│   │   └── dataExtractor.js                  # Data extraction utilities
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

### Reports

- `POST /api/report/generate` - Generate report
  ```json
  {
    "session_id": "uuid"
  }
  ```

- `GET /api/report/:reportId` - Get generated report
- `GET /api/report/session/:sessionId` - Get report by session

## OpenAI Assistant Setup

The system automatically creates two OpenAI assistants on startup:

1. **Brand Awareness Conversation Assistant** - Handles the conversation flow
2. **Brand Awareness Report Generator** - Generates personalized reports

Assistant IDs are automatically saved to your `.env` file for reference.

### Manual Assistant Creation (Optional)

If you want to create assistants manually or reuse existing ones:

1. Go to [OpenAI Assistants Dashboard](https://platform.openai.com/assistants)
2. Create assistants with the system prompts from:
   - `config/assistants/brand_awareness_assistant.json`
   - `config/report_generators/brand_awareness_report.json`
3. Add the assistant IDs to your `.env` file:
   ```bash
   BRAND_AWARENESS_ASSISTANT_ID=asst_xxxxx
   BRAND_AWARENESS_REPORT_GENERATOR_ID=asst_xxxxx
   ```

## Configuration

### Adding New Funnels

1. Add funnel definition to `config/funnels.json`
2. Create assistant config in `config/assistants/[funnel_id]_assistant.json`
3. Create report generator config in `config/report_generators/[funnel_id]_report.json`
4. Update `src/services/openai.service.js` to initialize new assistants

### Customizing Questions

Edit `config/assistants/brand_awareness_assistant.json`:
- Modify `questions` array to add/remove questions
- Update `report_components` to define unlock conditions
- Adjust `system_prompt_template` for conversation style

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

## Future Enhancements

- [ ] Add remaining 5 funnels (Customer Acquisition, Retention, etc.)
- [ ] Add user authentication
- [ ] Implement Redis for session caching
- [ ] Add report export (PDF, DOCX)
- [ ] Add more personas for testing
- [ ] Implement two-assistant persona simulation
- [ ] Add conversation resumption
- [ ] Add report sharing/email

## License

ISC

## Support

For issues or questions, please check the troubleshooting section or review the code comments.

---

**Built with ❤️ for small business owners who feel invisible**

