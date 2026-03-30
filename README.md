# N1 Support Bot

Telegram chatbot for N1 (first-line) support using RAG knowledge base.

## Overview

The N1 Support Bot receives user-reported issues, validates them through conversational questioning using a RAG knowledge base, and escalates confirmed bugs to human agents.

## Features

- Receive and acknowledge user issue reports
- Search RAG knowledge base for relevant articles
- Ask validation questions (1-3 questions based on issue category)
- Provide self-service guidance for known issues
- Escalate validated bugs to human agents
- Store all conversations in database

## Tech Stack

- Python 3.11+
- python-telegram-bot v21+
- PostgreSQL with rag schema
- OpenAI GPT-4o

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials
3. Start with Docker Compose:
   ```bash
   docker-compose --profile bot up -d
   ```
4. Initialize the database with KB data:
   ```bash
   python scripts/seed_kb.py
   ```

## Bot Commands

- `/start` - Welcome message
- `/help` - Show available commands
- `/report <issue>` - Report an issue
- `/status <report_id>` - Check report status
- `/cancel` - Cancel current conversation

## Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run locally
python -m src.main
```

## Project Structure

```
src/
  bot/           - Telegram bot handlers
  database/      - Database models and repositories
  escalation/    - Escalation handling
  rag/           - RAG knowledge base search
  utils/         - Utilities (logger, OpenAI client)
  validation/    - Issue classification and validation
```

## License

Proprietary
