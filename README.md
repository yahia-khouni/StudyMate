# StudyAI - AI-Powered Bilingual Study Platform

An AI-powered study platform helping university students organize courses, generate summaries/quizzes/flashcards, and track progress through intelligent learning tools.

## Features

- 🔐 **User Authentication** - Email/password + Google OAuth with email verification
- 📚 **Course Management** - Create courses, chapters, upload materials (PDF/DOCX)
- 🤖 **AI-Powered Tools** - Auto-generate summaries, quizzes, and flashcards
- 💬 **RAG Chatbot** - Course-specific AI assistant using your materials
- 📅 **Study Calendar** - Schedule sessions, track deadlines, auto-generate study plans
- 🔥 **Streak System** - Daily activity tracking with timezone-aware streaks
- 🌍 **Bilingual** - Full English/French support (UI + AI content)

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- TanStack Query (React Query)
- Zustand (state management)
- i18next (internationalization)

### Backend
- Node.js + Express
- MySQL 8 (primary database)
- ChromaDB (vector database for RAG)
- Redis + BullMQ (job queues)
- LangChain + BGE-M3 embeddings

### AI Models (via OpenRouter)
- Nemotron Nano VL - Document/image extraction
- DeepSeek R1 - Content generation

## Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- OpenRouter API key

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd StudyMate
npm install
```

### 2. Environment Setup

```bash
# Copy environment files
cp server/.env.example server/.env

# Edit server/.env with your API keys
```

### 3. Start Docker Services

```bash
# Start MySQL, ChromaDB, Redis, Mailhog
npm run docker:up

# View logs
npm run docker:logs
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start Development Servers

```bash
# Start both client and server
npm run dev

# Or run separately
npm run dev:client  # Frontend at http://localhost:5173
npm run dev:server  # Backend at http://localhost:3000
```

## Project Structure

```
StudyMate/
├── client/                 # React frontend (TypeScript)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API client
│   │   ├── stores/         # Zustand stores
│   │   ├── i18n/           # Translations
│   │   └── lib/            # Utilities
│   └── ...
├── server/                 # Express backend (JavaScript)
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── routes/         # API routes
│   │   ├── models/         # Database models
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business logic
│   │   ├── jobs/           # Background workers
│   │   └── config/         # Configuration
│   └── ...
├── database/               # SQL migrations
├── docker-compose.yml      # Local dev services
└── package.json            # Root workspace config
```

## Services (Docker)

| Service  | Port  | Description           |
|----------|-------|-----------------------|
| MySQL    | 3306  | Primary database      |
| ChromaDB | 8000  | Vector database       |
| Redis    | 6379  | Job queue             |
| Mailhog  | 8025  | Email testing UI      |

## Scripts

```bash
npm run dev          # Start all dev servers
npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services
npm run db:migrate   # Run database migrations
npm run lint         # Lint all code
npm run format       # Format all code
```

## License

MIT
