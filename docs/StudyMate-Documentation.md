# StudyMate - Complete Application Documentation

## Overview

**StudyMate** is an AI-powered study platform that transforms your learning materials into interactive study tools. Upload your course documents, and StudyMate automatically extracts, structures, and enhances the content, then generates summaries, quizzes, flashcards, and provides an AI chat assistant—all designed to help you study more effectively.

### Tech Stack
- **Backend**: Node.js/Express with MySQL database
- **Frontend**: React with TypeScript, Vite, and Tailwind CSS
- **AI Models**: DeepSeek R1T2 Chimera (text), Nemotron VL (vision) via OpenRouter
- **Embeddings**: BGE-M3 via HuggingFace (with local fallback)
- **Vector Store**: SQLite for semantic search
- **Real-time**: Socket.IO for notifications
- **Job Queue**: BullMQ with Redis for background processing

---

## Features

### 1. User Authentication & Profiles

**Authentication Methods:**
- Email/password registration with email verification
- Google OAuth integration
- Password reset via email

**Security:**
- JWT access tokens (15-minute expiry) with refresh tokens (7-day expiry)
- Passwords hashed with bcrypt (12 salt rounds)
- Tokens stored as SHA-256 hashes

**User Profiles:**
- Customizable name, avatar, and timezone
- Language preference (English/French)
- Account settings and deletion

---

### 2. Course & Chapter Organization

**Courses:**
- Create courses with title, description, syllabus, and language
- 12 customizable colors for visual organization
- Full isolation per user

**Chapters:**
- Hierarchical structure: Courses → Chapters → Materials
- Drag-and-drop reordering
- Completion tracking with status workflow

**Materials:**
- Upload PDF and DOCX files (up to 50MB each, max 10 per upload)
- Automatic processing with status tracking
- Stored with UUID-based naming

---

### 3. AI-Powered Learning Tools

#### Summaries
- AI-generated 300-800 word summaries from your materials
- Available in both English and French
- Can regenerate to get fresh perspectives

#### Quizzes
- Multiple-choice questions with 4 options each
- Three difficulty levels: Easy, Medium, Hard
- Configurable question count (3, 5, 10, or 15)
- Explanations for each answer
- Attempt tracking with scoring (70% to pass)

#### Flashcards
- AI-generated study cards from your content
- Front/back format for active recall
- **Spaced Repetition (SM-2 Algorithm)**:
  - Rate your recall from 0-5
  - Cards scheduled based on ease factor
  - Automatic interval adjustment
  - Tracks mastery progress

#### AI Chat (RAG)
- Course-scoped chat assistant
- Answers questions using your uploaded materials
- Shows sources for transparency
- Maintains conversation history

---

### 4. Calendar & Study Planning

**Calendar Events:**
- Types: Study sessions, Deadlines, Exams, Other
- All-day event support
- Recurrence rules (daily, weekly, etc.)
- Reminder notifications

**Study Plan Generator:**
- Auto-generates a study schedule working backward from an exam date
- Configurable: sessions per day, duration, study days
- Creates one event per chapter
- Smart distribution of content

---

### 5. Streak & Gamification

**Streak System:**
- Tracks consecutive days of study activity
- Records longest streak achieved
- Resets after missing a day

**Tracked Activities:**
- Uploading materials
- Reviewing flashcards
- Taking quizzes
- Chatting with AI assistant

**Visualizations:**
- Activity heatmap calendar
- Daily/weekly activity summaries
- Progress statistics

---

### 6. Notifications

**Real-Time Notifications** (via WebSocket):
- Document processing complete
- Upcoming deadline reminders
- Quiz passed achievements
- Streak maintenance reminders
- Badge/achievement unlocks

---

### 7. Progress Tracking

**Dashboard Analytics:**
- Weekly activity overview
- Current streak status
- Upcoming deadlines
- Course progress cards
- Quick access to recent materials

**Detailed Progress:**
- Per-chapter completion (weighted):
  - 40% - Materials processed
  - 20% - Summary generated
  - 20% - Quiz attempted
  - 20% - Flashcards reviewed
- Quiz performance (average & best scores)
- Flashcard mastery percentage

---

## Document Processing Pipeline

This is the heart of StudyMate—how your uploaded documents become interactive learning tools.

### Stage 1: File Upload

```
User uploads PDF/DOCX → Multer middleware validates file
                      → File saved to uploads/ with UUID name
                      → Material record created (status: 'pending')
```

### Stage 2: Text Extraction

```javascript
// Different extractors based on file type:
PDF files  → pdf-parse library → raw text
DOCX files → mammoth library   → raw text
```

The raw extracted text often contains formatting artifacts, OCR errors, and disorganized structure.

### Stage 3: AI Content Structuring

The raw text is sent to **DeepSeek R1T2 Chimera** (671B MoE model) which:
- Organizes content into clean Markdown with headings
- Creates proper bullet points and code blocks
- Fixes OCR errors while preserving technical terms
- Outputs in the user's preferred language (English/French)

The model's `<think>` reasoning blocks are stripped from the final output.

### Stage 4: Text Chunking

```javascript
// Chunking configuration:
CHUNK_SIZE    = 2000 characters  // Target size per chunk
CHUNK_OVERLAP = 200 characters   // Overlap for context continuity
MAX_CHUNKS    = 20               // Maximum chunks per document
```

**Chunking Strategy:**
1. Split structured content into chunks of ~2000 characters
2. Attempt to break at sentence boundaries (periods followed by space/newline)
3. Maintain 200-character overlap between consecutive chunks
4. Store chunk metadata: startChar, endChar, index

### Stage 5: Embedding Generation

Each chunk is converted to a **384-dimensional vector** for semantic search:

**Primary Method**: HuggingFace BGE-M3 API
- Sends text to HuggingFace Inference API
- Returns high-quality multilingual embeddings

**Fallback Method**: Local hash-based embeddings
- Word-based hashing with position weighting
- Deterministic (same text = same vector)
- L2 normalization applied

### Stage 6: Vector Storage

Embeddings are stored in a **SQLite database** for fast similarity search:

```sql
-- Table structure:
embeddings (
  id, course_id, chapter_id, material_id, 
  chunk_index, content, embedding (JSON array)
)
```

Indexed by course/chapter/material for efficient retrieval.

### Vision Processing (Optional)

For documents with images, diagrams, or charts:

**Model**: Nemotron VL (12B vision model)
- Analyzes document images
- Extracts text from embedded screenshots
- Describes visual elements (charts, graphs, equations)
- Returns structured JSON with key points

---

## End-to-End Usage Scenario

Let's walk through a complete user journey with StudyMate:

### Scenario: Sarah Prepares for Her Biology Exam

#### Day 1: Getting Started

**1. Registration & Login**
```
Sarah → Creates account with email
     → Verifies email via link
     → Logs in (JWT tokens issued)
     → Streak initialized at 0
```

**2. Creating a Course**
```
Sarah → Creates "Biology 101" course
     → Sets language to English
     → Chooses green color theme
     → Course ID generated, assigned to her user
```

**3. Adding Chapters**
```
Sarah → Creates chapters:
     - Chapter 1: Cell Structure
     - Chapter 2: Cell Division
     - Chapter 3: Genetics
     → Chapters ordered automatically
```

#### Day 2: Uploading Materials

**4. Document Upload**
```
Sarah → Opens Chapter 1: Cell Structure
     → Uploads "lecture-notes.pdf" (3.2 MB)
     → Upload accepted, material created with 'pending' status
```

**5. Background Processing Begins**
```
[Document Worker picks up job]

Step 1: Extract text from PDF
        → pdf-parse extracts 15,000 characters of raw text
        
Step 2: AI Structuring
        → DeepSeek R1T2 receives raw text
        → Returns clean Markdown with:
          - Proper headings (## Cell Membrane, ## Organelles)
          - Bullet point lists
          - Fixed typos and OCR errors
        → Stored as 'structuredContent'

Step 3: Chunking
        → 15,000 chars ÷ 2000 = ~8 chunks
        → With overlap: 8 chunks created
        → Each chunk: {content, startChar, endChar, index}

Step 4: Embedding Generation
        → Each chunk → HuggingFace BGE-M3 API
        → 8 vectors of 384 dimensions each
        
Step 5: Vector Storage
        → All 8 embeddings stored in SQLite
        → Linked to: course_id, chapter_id, material_id

Status → 'completed'
Notification → "Your document has been processed!"
```

**6. Sarah's Streak Updates**
```
Activity logged: 'upload' for Chapter 1
Sarah's streak: 0 → 1 day
```

#### Day 3: Studying with AI Tools

**7. Generating a Summary**
```
Sarah → Clicks "Generate Summary" for Chapter 1
     → AI reads structuredContent from all materials
     → Generates 500-word summary highlighting:
       - Key concepts about cell membranes
       - Important organelle functions
       - Study-worthy terms
     → Summary stored in database
```

**8. Taking a Quiz**
```
Sarah → Clicks "Generate Quiz" 
     → Selects: Medium difficulty, 5 questions
     
AI generates:
{
  "questionText": "What is the primary function of the cell membrane?",
  "options": [
    "Energy production",
    "Controlling what enters/exits the cell",  // correct
    "Protein synthesis",
    "DNA storage"
  ],
  "correctAnswerIndex": 1,
  "explanation": "The cell membrane is selectively permeable..."
}

Sarah → Takes quiz, scores 4/5 (80%)
     → Result: PASSED (≥70%)
     → Attempt recorded with time taken
     → Streak activity logged
```

**9. Creating Flashcards**
```
Sarah → Generates flashcard deck (10 cards)
     
AI creates cards like:
- Front: "What is the mitochondria's nickname?"
- Back: "The powerhouse of the cell - it produces ATP"

Sarah → Reviews cards using spaced repetition
     → Rates each recall: 0 (forgot) to 5 (perfect)
     → SM-2 algorithm schedules next review:
       - Easy cards: reviewed in 3-7 days
       - Hard cards: reviewed tomorrow
```

**10. Asking the AI Chat**
```
Sarah → Opens Chat for Biology 101
     → Asks: "How does osmosis differ from diffusion?"

RAG Pipeline:
1. Question embedded → 384-dim vector
2. Cosine similarity search in SQLite vectors
3. Top 5 relevant chunks retrieved from her materials
4. Context + question sent to DeepSeek
5. AI responds with material-based answer
6. Sources shown: "Based on lecture-notes.pdf, Chapter 1"
```

#### Day 5: Planning for the Exam

**11. Using the Study Planner**
```
Sarah → Sets exam date: February 15
     → Configures:
       - 2 study sessions per day
       - 60 minutes each
       - Study days: Mon-Fri
       
Planner generates:
- Feb 3 (Mon) 9:00 AM: Study "Cell Structure" (60 min)
- Feb 3 (Mon) 2:00 PM: Study "Cell Structure" (60 min)  
- Feb 4 (Tue) 9:00 AM: Study "Cell Division" (60 min)
... and so on through all chapters

Calendar events created automatically!
```

**12. Receiving Reminders**
```
Feb 10, 8:00 AM:
[Notification Worker runs]
→ Checks for users with no activity yesterday
→ Sarah was active, no streak reminder needed

Feb 14, 9:00 AM:
[Notification Worker runs]
→ Finds Sarah's exam tomorrow
→ Sends deadline reminder: "Biology 101 exam is tomorrow!"
```

#### Exam Day: Final Review

**13. Dashboard Overview**
```
Sarah checks her dashboard:
┌─────────────────────────────────────────┐
│ 🔥 Streak: 12 days                      │
│ 📊 This Week: 14 activities             │
│                                         │
│ Biology 101                    [85%] ██ │
│ - All materials processed              │
│ - Summaries generated                  │
│ - Quiz avg: 82%                        │
│ - Flashcard mastery: 78%               │
│                                         │
│ 📅 Today: Biology 101 Exam (2:00 PM)   │
└─────────────────────────────────────────┘
```

**14. Quick Flashcard Review**
```
Sarah → Reviews cards due today
     → 5 cards scheduled for review
     → Rates each, algorithm adjusts future schedules
     → Confidence boosted!
```

**15. Exam Complete!**
```
Sarah aces her exam thanks to:
✓ Structured, searchable notes
✓ AI-generated summaries for quick review
✓ Spaced repetition for long-term retention
✓ Practice quizzes with explanations
✓ AI chat for clarifying confusing concepts
✓ Organized study schedule
```

---

## API Flow Summary

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Express    │────▶│    MySQL     │
│   (React)    │◀────│   Backend    │◀────│   Database   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              ┌──────────┐  ┌──────────┐
              │ OpenRouter│  │ SQLite   │
              │ (AI APIs) │  │ (Vectors)│
              └──────────┘  └──────────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
        ┌──────────┐  ┌──────────┐
        │ DeepSeek │  │ Nemotron │
        │ R1T2     │  │ VL       │
        │ (Text)   │  │ (Vision) │
        └──────────┘  └──────────┘
```

---

## Key Technical Details

### Chunking Algorithm
```javascript
function chunkText(text) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('. ', end);
      if (lastPeriod > start + CHUNK_SIZE/2) {
        end = lastPeriod + 1;
      }
    }
    
    chunks.push({
      content: text.slice(start, end),
      startChar: start,
      endChar: end,
      index: chunks.length
    });
    
    // Move start with overlap
    start = end - CHUNK_OVERLAP;
  }
  
  return chunks.slice(0, MAX_CHUNKS);
}
```

### SM-2 Spaced Repetition
```javascript
function calculateNextReview(quality, card) {
  // quality: 0-5 (0=forgot, 5=perfect)
  
  if (quality < 3) {
    // Reset on poor recall
    card.repetitions = 0;
    card.interval = 1;
  } else {
    // Adjust ease factor
    card.easeFactor += (0.1 - (5 - quality) * 0.08);
    card.easeFactor = Math.max(1.3, card.easeFactor);
    
    // Calculate next interval
    if (card.repetitions === 0) card.interval = 1;
    else if (card.repetitions === 1) card.interval = 6;
    else card.interval *= card.easeFactor;
    
    card.repetitions++;
  }
  
  card.nextReviewDate = addDays(today, card.interval);
  return card;
}
```

### Cosine Similarity Search
```javascript
function findSimilarChunks(queryEmbedding, courseId, topK = 5) {
  const allEmbeddings = getEmbeddingsByCourse(courseId);
  
  const scored = allEmbeddings.map(doc => ({
    ...doc,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding)
  }));
  
  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

---

## Conclusion

StudyMate transforms passive document storage into an active learning system by:

1. **Extracting & Structuring** - Converting messy documents into clean, organized content
2. **Chunking & Embedding** - Making content searchable through semantic similarity
3. **AI Generation** - Creating personalized study materials (summaries, quizzes, flashcards)
4. **Spaced Repetition** - Optimizing memory retention with proven algorithms
5. **Progress Tracking** - Motivating consistent study through streaks and analytics
6. **Smart Planning** - Automating study schedules based on exam dates

The combination of modern AI capabilities with proven study techniques creates a powerful tool for effective learning.
