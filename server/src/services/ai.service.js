/**
 * AI Service
 * Integration with OpenRouter API for DeepSeek R1T2 Chimera (text generation)
 * and Nemotron VL (vision), plus HuggingFace Inference API for BGE-M3 embeddings
 */

const axios = require('axios');
const logger = require('../config/logger');

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// HuggingFace configuration
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/BAAI/bge-m3';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Model IDs - Free tier models from OpenRouter
const MODELS = {
  NEMOTRON_VL: 'nvidia/nemotron-nano-12b-v2-vl:free', // Vision-capable model via OpenRouter
  // DeepSeek R1T2 Chimera - 671B MoE model with strong reasoning (163K context)
  // Used for all text generation: structuring, summaries, quizzes, flashcards, chat
  TEXT_MODEL: 'tngtech/deepseek-r1t2-chimera:free',
};

// Chunking configuration
const CHUNK_CONFIG = {
  MAX_TOKENS: 512,
  OVERLAP_TOKENS: 50,
  CHARS_PER_TOKEN: 4, // Approximation for tokenization
};

/**
 * Clean DeepSeek R1 model response by removing <think>...</think> reasoning blocks
 * The DeepSeek R1 models emit thinking/reasoning in <think> tags before the actual answer
 * @param {string} content - Raw model response
 * @returns {string} - Cleaned response with only the actual answer
 */
function cleanDeepSeekResponse(content) {
  if (!content) return content;
  
  // Remove <think>...</think> blocks (reasoning tokens)
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // Also handle unclosed <think> tags (in case response was cut off)
  cleaned = cleaned.replace(/<think>[\s\S]*/gi, '');
  
  // Trim whitespace
  return cleaned.trim();
}

/**
 * Analyze a document page/image using Nemotron VL
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mimeType - Image MIME type
 * @param {string} language - Target language (en/fr)
 * @returns {Promise<{text: string, structure: Object}>}
 */
async function analyzePageWithVision(imageBase64, mimeType = 'image/png', language = 'en') {
  if (!OPENROUTER_API_KEY) {
    logger.warn('OpenRouter API key not configured, skipping vision analysis');
    return { text: '', structure: null };
  }

  const languagePrompt = language === 'fr' 
    ? 'Respond in French.' 
    : 'Respond in English.';

  const systemPrompt = `You are an educational content extraction assistant. Analyze the provided document page/slide image and extract all educational content.

${languagePrompt}

Your task:
1. Extract ALL text visible in the image, including headers, body text, captions, and labels
2. Describe any diagrams, charts, graphs, or visual elements in detail
3. Extract text from any embedded images or screenshots
4. Identify mathematical formulas or equations
5. Preserve the hierarchical structure (headings, subheadings, lists)

Output format (JSON):
{
  "title": "Page/slide title if present",
  "mainText": "All extracted text content",
  "visualElements": [
    {
      "type": "diagram|chart|image|equation",
      "description": "Detailed description of the visual element",
      "extractedText": "Any text within the visual element"
    }
  ],
  "keyPoints": ["Key educational points from this page"],
  "structure": {
    "headings": ["List of headings found"],
    "hasLists": true/false,
    "hasCode": true/false,
    "hasMath": true/false
  }
}`;

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODELS.NEMOTRON_VL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Extract and analyze all educational content from this document page/slide.',
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'StudyAI',
        },
        timeout: 120000, // 2 minute timeout for vision processing
      }
    );

    const content = response.data.choices[0]?.message?.content;
    
    if (!content) {
      logger.warn('Empty response from vision model');
      return { text: '', structure: null };
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(content);
      
      // Combine all text content
      let fullText = '';
      if (parsed.title) fullText += `# ${parsed.title}\n\n`;
      if (parsed.mainText) fullText += `${parsed.mainText}\n\n`;
      
      if (parsed.visualElements && parsed.visualElements.length > 0) {
        for (const visual of parsed.visualElements) {
          fullText += `\n[${visual.type.toUpperCase()}]: ${visual.description}\n`;
          if (visual.extractedText) {
            fullText += `Text: ${visual.extractedText}\n`;
          }
        }
      }
      
      if (parsed.keyPoints && parsed.keyPoints.length > 0) {
        fullText += '\n## Key Points\n';
        for (const point of parsed.keyPoints) {
          fullText += `- ${point}\n`;
        }
      }

      return {
        text: fullText.trim(),
        structure: parsed.structure || null,
        keyPoints: parsed.keyPoints || [],
        visualElements: parsed.visualElements || [],
      };
    } catch (parseError) {
      // If JSON parsing fails, return raw content
      logger.warn('Failed to parse vision model JSON response:', parseError.message);
      return { text: content, structure: null };
    }
  } catch (error) {
    logger.error('Vision analysis error:', error.response?.data || error.message);
    throw new Error(`Vision analysis failed: ${error.message}`);
  }
}

/**
 * Structure and enhance extracted text using AI
 * @param {string} rawText - Raw extracted text from document
 * @param {string} language - Target language (en/fr)
 * @returns {Promise<string>} - Structured markdown content
 */
async function structureContent(rawText, language = 'en') {
  if (!OPENROUTER_API_KEY) {
    logger.warn('OpenRouter API key not configured, returning raw text');
    return rawText;
  }

  if (!rawText || rawText.trim().length < 100) {
    return rawText;
  }

  const languagePrompt = language === 'fr'
    ? 'The content is in French. Keep it in French and ensure proper French grammar.'
    : 'The content is in English. Ensure proper English grammar.';

  const systemPrompt = `You are an educational content structuring assistant. Your task is to organize and structure extracted document text into clean, well-formatted educational content.

${languagePrompt}

Guidelines:
1. Organize content with clear headings (# for main, ## for sub, ### for sub-sub)
2. Create bullet points for lists of items
3. Use numbered lists for sequential steps or processes
4. Preserve all original information - do not add or remove content
5. Fix obvious OCR errors while preserving technical terminology
6. Format code blocks with appropriate syntax highlighting
7. Format mathematical equations properly
8. Add section breaks between distinct topics
9. Ensure logical flow and readability

Output clean Markdown format only. Do not include any explanations or commentary.`;

  try {
    // Truncate if too long (keep within context limits)
    const maxInputLength = 12000;
    const truncatedText = rawText.length > maxInputLength 
      ? rawText.substring(0, maxInputLength) + '\n\n[Content truncated...]'
      : rawText;

    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODELS.TEXT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Structure the following extracted document content:\n\n${truncatedText}` },
        ],
        temperature: 0.2,
        max_tokens: 8192,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'StudyAI',
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices[0]?.message?.content || rawText;
    return cleanDeepSeekResponse(content);
  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    logger.error('Content structuring error:', JSON.stringify(errorDetails, null, 2));
    // Return raw text on failure
    return rawText;
  }
}

/**
 * Split text into chunks suitable for embedding
 * @param {string} text - Text to chunk
 * @param {number} maxTokens - Maximum tokens per chunk
 * @param {number} overlapTokens - Number of overlap tokens between chunks
 * @returns {Array<{text: string, index: number, startChar: number, endChar: number}>}
 */
function chunkText(text, maxTokens = CHUNK_CONFIG.MAX_TOKENS, overlapTokens = CHUNK_CONFIG.OVERLAP_TOKENS) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const maxChars = maxTokens * CHUNK_CONFIG.CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHUNK_CONFIG.CHARS_PER_TOKEN;
  const stepSize = maxChars - overlapChars;

  const chunks = [];
  let index = 0;
  let startChar = 0;

  while (startChar < text.length) {
    let endChar = Math.min(startChar + maxChars, text.length);

    // Try to break at sentence or paragraph boundary
    if (endChar < text.length) {
      // Look for paragraph break
      const paragraphBreak = text.lastIndexOf('\n\n', endChar);
      if (paragraphBreak > startChar + stepSize / 2) {
        endChar = paragraphBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = findLastSentenceBreak(text, startChar, endChar);
        if (sentenceBreak > startChar + stepSize / 2) {
          endChar = sentenceBreak;
        }
      }
    }

    const chunkText = text.substring(startChar, endChar).trim();
    
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index,
        startChar,
        endChar,
      });
      index++;
    }

    startChar = endChar - overlapChars;
    
    // Avoid infinite loop
    if (startChar >= text.length - 10) break;
  }

  return chunks;
}

/**
 * Find the last sentence break in a text range
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {number}
 */
function findLastSentenceBreak(text, start, end) {
  const searchText = text.substring(start, end);
  
  // Look for sentence endings followed by space or newline
  const patterns = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let lastBreak = -1;

  for (const pattern of patterns) {
    const pos = searchText.lastIndexOf(pattern);
    if (pos > lastBreak) {
      lastBreak = pos;
    }
  }

  return lastBreak > 0 ? start + lastBreak + 2 : -1;
}

/**
 * Generate embeddings using HuggingFace BGE-M3 model
 * NOTE: For document processing, use embedding.service.js which handles streaming
 * This function is kept for backward compatibility with query embeddings
 * @param {Array<string>} texts - Array of texts to embed
 * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) {
    return [];
  }

  // For single queries, process directly
  if (texts.length <= 2) {
    if (!HUGGINGFACE_API_KEY) {
      logger.warn('HuggingFace API key not configured, using fallback embeddings');
      return generateFallbackEmbeddings(texts);
    }

    try {
      const response = await axios.post(
        HUGGINGFACE_API_URL,
        {
          inputs: texts,
          options: { wait_for_model: true },
        },
        {
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const embeddings = response.data;
      response.data = null; // Clear reference
      return embeddings;
    } catch (error) {
      logger.error('HuggingFace embedding error:', error.response?.data || error.message);
      return generateFallbackEmbeddings(texts);
    }
  }

  // For larger batches, warn and use fallback (document processing should use embedding.service.js)
  logger.warn(`generateEmbeddings called with ${texts.length} texts - consider using embedding.service.js for document processing`);
  return generateFallbackEmbeddings(texts);
}

/**
 * Fallback embedding generation - simple hash-based pseudo-embeddings
 * Memory efficient alternative when HuggingFace is unavailable or failing
 * @param {Array<string>} texts
 * @returns {Promise<Array<Array<number>>>}
 */
function generateFallbackEmbeddings(texts) {
  logger.info('Using fallback hash-based embedding generation');
  
  // Use smaller dimension (384) for memory efficiency
  const EMBEDDING_DIM = 384;
  const embeddings = [];
  
  for (const text of texts) {
    const embedding = new Array(EMBEDDING_DIM).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    // Simple word-based hashing
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
      }
      // Distribute across embedding dimensions
      const idx = Math.abs(hash) % EMBEDDING_DIM;
      embedding[idx] += 1 / (1 + Math.log(1 + i));
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
    const normalized = embedding.map(val => val / magnitude);
    embeddings.push(normalized);
  }
  
  return embeddings;
}

/**
 * Generate a summary of the content
 * @param {string} content - Content to summarize
 * @param {string} language - Target language (en/fr)
 * @returns {Promise<string>}
 */
async function generateSummary(content, language = 'en') {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const languagePrompt = language === 'fr'
    ? 'Generate the summary in French.'
    : 'Generate the summary in English.';

  const systemPrompt = `You are an educational content summarizer. Create a comprehensive yet concise summary of the provided study material.

${languagePrompt}

Guidelines:
1. Capture all main concepts and key points
2. Maintain educational value and accuracy
3. Use clear, student-friendly language
4. Structure with headings and bullet points
5. Include any important definitions, formulas, or facts
6. Keep the summary between 300-800 words

Output format: Clean Markdown`;

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODELS.TEXT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Summarize the following study material:\n\n${content.substring(0, 15000)}` },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'StudyAI',
        },
        timeout: 60000,
      }
    );

    const responseContent = response.data.choices[0]?.message?.content || '';
    return cleanDeepSeekResponse(responseContent);
  } catch (error) {
    logger.error('Summary generation error:', error.response?.data || error.message);
    throw new Error(`Summary generation failed: ${error.message}`);
  }
}

/**
 * Generate quiz questions from content
 * @param {string} content - Content to generate questions from
 * @param {string} language - Target language (en/fr)
 * @param {string} difficulty - Difficulty level (easy/medium/hard)
 * @param {number} questionCount - Number of questions to generate
 * @returns {Promise<Array<{questionText: string, options: string[], correctAnswerIndex: number, explanation: string}>>}
 */
async function generateQuiz(content, language = 'en', difficulty = 'medium', questionCount = 5) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const languagePrompt = language === 'fr'
    ? 'Generate all questions, options, and explanations in French.'
    : 'Generate all questions, options, and explanations in English.';

  const difficultyGuide = {
    easy: 'Focus on basic recall and simple concepts. Questions should test fundamental understanding.',
    medium: 'Include application and comprehension questions. Test understanding of relationships between concepts.',
    hard: 'Include analysis and synthesis questions. Test deep understanding and ability to apply concepts to new situations.',
  };

  const systemPrompt = `You are an educational quiz generator. Create multiple-choice questions based on the provided study material.

${languagePrompt}

Difficulty level: ${difficulty.toUpperCase()}
${difficultyGuide[difficulty] || difficultyGuide.medium}

Guidelines:
1. Create exactly ${questionCount} multiple-choice questions
2. Each question should have exactly 4 options (A, B, C, D)
3. Only one option should be correct
4. Include a brief explanation for why the correct answer is right
5. Questions should cover different aspects of the content
6. Avoid trick questions or overly ambiguous wording
7. Make distractors (wrong options) plausible but clearly incorrect

You MUST respond with a valid JSON array. Do not include any text before or after the JSON.

Output format (JSON array):
[
  {
    "questionText": "The question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]`;

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODELS.TEXT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate ${questionCount} ${difficulty} quiz questions based on this content:\n\n${content.substring(0, 12000)}` },
        ],
        temperature: 0.5,
        max_tokens: 4096,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'StudyAI',
        },
        timeout: 90000,
      }
    );

    let responseContent = response.data.choices[0]?.message?.content || '[]';
    // Clean DeepSeek reasoning tokens
    responseContent = cleanDeepSeekResponse(responseContent);
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonString = responseContent;
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }
    
    const questions = JSON.parse(jsonString);
    
    // Validate and sanitize questions
    return questions.map((q, index) => ({
      questionText: q.questionText || q.question || `Question ${index + 1}`,
      options: Array.isArray(q.options) && q.options.length === 4 
        ? q.options 
        : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswerIndex: typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
        ? q.correctAnswerIndex
        : 0,
      explanation: q.explanation || 'No explanation provided.',
    })).slice(0, questionCount);
  } catch (error) {
    logger.error('Quiz generation error:', JSON.stringify(error.response?.data || error.message, null, 2));
    throw new Error(`Quiz generation failed: ${error.message}`);
  }
}

/**
 * Generate flashcards from content
 * @param {string} content - Content to generate flashcards from
 * @param {string} language - Target language (en/fr)
 * @param {number} cardCount - Number of flashcards to generate
 * @returns {Promise<Array<{frontContent: string, backContent: string}>>}
 */
async function generateFlashcards(content, language = 'en', cardCount = 10) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const languagePrompt = language === 'fr'
    ? 'Generate all flashcard content in French.'
    : 'Generate all flashcard content in English.';

  const systemPrompt = `You are an educational flashcard generator. Create study flashcards based on the provided material.

${languagePrompt}

Guidelines:
1. Create exactly ${cardCount} flashcards
2. Front side: A clear question, term, or concept prompt
3. Back side: A concise but complete answer or explanation
4. Focus on key concepts, definitions, facts, and important relationships
5. Make cards specific and testable (avoid vague or overly broad cards)
6. Use active recall format - the front should prompt the learner to recall information
7. Cover different aspects of the content

Card types to include:
- Definition cards: "What is X?" → "X is..."
- Concept cards: "Explain Y" → "Y works by..."
- Application cards: "When would you use Z?" → "Z is used when..."
- Comparison cards: "Difference between A and B?" → "A differs from B in..."

You MUST respond with a valid JSON array. Do not include any text before or after the JSON.

Output format (JSON array):
[
  {
    "frontContent": "Question or term on front of card",
    "backContent": "Answer or explanation on back of card"
  }
]`;

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODELS.TEXT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate ${cardCount} study flashcards based on this content:\n\n${content.substring(0, 12000)}` },
        ],
        temperature: 0.5,
        max_tokens: 4096,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'StudyAI',
        },
        timeout: 90000,
      }
    );

    let responseContent = response.data.choices[0]?.message?.content || '[]';
    // Clean DeepSeek reasoning tokens
    responseContent = cleanDeepSeekResponse(responseContent);
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonString = responseContent;
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }
    
    const cards = JSON.parse(jsonString);
    
    // Validate and sanitize flashcards
    return cards.map((card, index) => ({
      frontContent: card.frontContent || card.front || `Card ${index + 1} Front`,
      backContent: card.backContent || card.back || `Card ${index + 1} Back`,
    })).slice(0, cardCount);
  } catch (error) {
    logger.error('Flashcard generation error:', JSON.stringify(error.response?.data || error.message, null, 2));
    throw new Error(`Flashcard generation failed: ${error.message}`);
  }
}

/**
 * Generate a RAG-based chat response
 * @param {string} query - User's question
 * @param {Array<{content: string, metadata: Object}>} context - Retrieved context chunks
 * @param {Array<{role: string, content: string}>} chatHistory - Previous messages in conversation
 * @param {string} language - Target language (en/fr)
 * @returns {Promise<{response: string, sources: Array<{chapterId: string, chapterTitle: string, excerpt: string}>}>}
 */
async function generateChatResponse(query, context, chatHistory = [], language = 'en') {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const languagePrompt = language === 'fr'
    ? 'Respond in French. The user may ask in French or English.'
    : 'Respond in English. The user may ask in English or French.';

  // Build context string with source tracking
  const sources = [];
  let contextString = '';
  let hasContext = false;
  
  if (context && context.length > 0) {
    hasContext = true;
    contextString = '\n\nRelevant course material:\n\n';
    context.forEach((chunk, index) => {
      const chapterId = chunk.metadata?.chapterId || 'unknown';
      const chapterTitle = chunk.metadata?.chapterTitle || 'Unknown Chapter';
      
      contextString += `[Source ${index + 1} - ${chapterTitle}]:\n${chunk.content}\n\n`;
      
      // Track unique sources
      if (!sources.find(s => s.chapterId === chapterId)) {
        sources.push({
          chapterId,
          chapterTitle,
          excerpt: chunk.content.substring(0, 150) + (chunk.content.length > 150 ? '...' : ''),
        });
      }
    });
  } else {
    contextString = '\n\nNote: No specific course material context is available for this query. The semantic search feature is currently disabled. Answer based on general knowledge but inform the user that you cannot reference their specific course materials.\n';
  }

  const systemPrompt = `You are a helpful study assistant for a student learning from their uploaded course materials. ${hasContext ? 'Answer questions based on the provided context from their study materials.' : 'Note: Course material search is currently unavailable, so you cannot reference specific uploaded materials.'}

${languagePrompt}

Guidelines:
1. ${hasContext ? 'Answer based ONLY on the provided course material context' : 'Since course materials are not searchable, provide helpful general knowledge but clarify this to the user'}
2. If the answer is not found in the context, say so clearly and offer to help with what is available
3. Be educational and explain concepts clearly
4. ${hasContext ? 'Reference specific parts of the material when helpful' : 'Suggest the user generate a summary or quiz for their chapter to access the content'}
5. Keep responses focused and relevant to the question
6. If appropriate, suggest related topics the student might want to explore
7. Use markdown formatting for clarity (headers, bullet points, code blocks)

${contextString}`;

  // Build messages array with chat history
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add recent chat history (last 6 messages to stay within context)
  const recentHistory = chatHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current query
  messages.push({ role: 'user', content: query });

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODELS.TEXT_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 2048,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'StudyAI',
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
    return {
      response: cleanDeepSeekResponse(content),
      sources: sources.slice(0, 5), // Limit to 5 sources
    };
  } catch (error) {
    logger.error('Chat response error:', JSON.stringify(error.response?.data || error.message, null, 2));
    throw new Error(`Chat response generation failed: ${error.message}`);
  }
}

/**
 * Sleep utility
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verify API connectivity
 * @returns {Promise<{openrouter: boolean, huggingface: boolean}>}
 */
async function verifyConnectivity() {
  const results = {
    openrouter: false,
    huggingface: false,
  };

  // Check OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      await axios.get('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` },
        timeout: 5000,
      });
      results.openrouter = true;
    } catch (error) {
      logger.warn('OpenRouter connectivity check failed:', error.message);
    }
  }

  // Check HuggingFace
  if (HUGGINGFACE_API_KEY) {
    try {
      await axios.get('https://huggingface.co/api/whoami', {
        headers: { 'Authorization': `Bearer ${HUGGINGFACE_API_KEY}` },
        timeout: 5000,
      });
      results.huggingface = true;
    } catch (error) {
      logger.warn('HuggingFace connectivity check failed:', error.message);
    }
  }

  return results;
}

module.exports = {
  analyzePageWithVision,
  structureContent,
  chunkText,
  generateEmbeddings,
  generateSummary,
  generateQuiz,
  generateFlashcards,
  generateChatResponse,
  verifyConnectivity,
  CHUNK_CONFIG,
  MODELS,
};
