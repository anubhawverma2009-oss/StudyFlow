import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  handleAnalyzeDocument,
  handleGenerateOrModifyNotes,
  handleTutorChat,
} from './server/services/geminiService';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions-store.json');

function ensureDataStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SESSIONS_FILE)) {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ users: {} }, null, 2), 'utf-8');
    }
  } catch {
    // Ignore
  }
}

async function startServer() {
  ensureDataStore();
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'ScholarSync AI Workspace API',
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      )
    });
  });

  app.post('/api/ai/analyze', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentTitle, subjectType, pageCount, documentContext } = req.body || {};
      if (!documentContext || typeof documentContext !== 'string') {
        res.status(400).json({ error: 'Valid documentContext is required.' });
        return;
      }

      const result = await handleAnalyzeDocument({
        documentTitle: String(documentTitle || 'Study Document').slice(0, 200),
        subjectType: String(subjectType || 'general'),
        pageCount: Number(pageCount) || 1,
        documentContext: documentContext.slice(0, 24000)
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/ai/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        documentContext,
        includedPages,
        currentPage,
        selectedText,
        userMessage,
        quickAction,
        recentHistory,
        pageImageBase64
      } = req.body || {};

      if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
        res.status(400).json({ error: 'Please enter a valid question or prompt.' });
        return;
      }

      const result = await handleTutorChat({
        documentContext: String(documentContext || '').slice(0, 24000),
        includedPages: Array.isArray(includedPages) ? includedPages : [Number(currentPage) || 1],
        currentPage: Number(currentPage) || 1,
        selectedText: typeof selectedText === 'string' ? selectedText.slice(0, 3000) : undefined,
        userMessage: userMessage.trim().slice(0, 4000),
        quickAction: typeof quickAction === 'string' ? quickAction : undefined,
        recentHistory: Array.isArray(recentHistory) ? recentHistory.slice(-6) : [],
        pageImageBase64: typeof pageImageBase64 === 'string' ? pageImageBase64 : undefined
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/ai/generate-notes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        documentTitle,
        subjectType,
        currentPage,
        selectedText,
        instruction,
        documentContext,
        includedPages
      } = req.body || {};

      const result = await handleGenerateOrModifyNotes({
        documentTitle: String(documentTitle || 'Study Document').slice(0, 200),
        subjectType: String(subjectType || 'general'),
        currentPage: Number(currentPage) || 1,
        selectedText: typeof selectedText === 'string' ? selectedText.slice(0, 3000) : undefined,
        instruction: String(instruction || 'Generate structured study notes.').slice(0, 2000),
        documentContext: String(documentContext || '').slice(0, 25000),
        includedPages: Array.isArray(includedPages) ? includedPages : [Number(currentPage) || 1],
        isFullGeneration: true
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/ai/modify-notes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        documentTitle,
        subjectType,
        currentPage,
        selectedText,
        instruction,
        targetSectionHeading,
        documentContext,
        includedPages,
        currentNotes
      } = req.body || {};

      if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
        res.status(400).json({ error: 'Please provide an instruction for modifying the notes.' });
        return;
      }

      const result = await handleGenerateOrModifyNotes({
        documentTitle: String(documentTitle || 'Study Document').slice(0, 200),
        subjectType: String(subjectType || 'general'),
        currentPage: Number(currentPage) || 1,
        selectedText: typeof selectedText === 'string' ? selectedText.slice(0, 3000) : undefined,
        instruction: instruction.trim().slice(0, 3000),
        targetSectionHeading:
          typeof targetSectionHeading === 'string' ? targetSectionHeading : undefined,
        documentContext: String(documentContext || '').slice(0, 25000),
        includedPages: Array.isArray(includedPages) ? includedPages : [Number(currentPage) || 1],
        currentNotes,
        isFullGeneration: false
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/sessions/save', (req: Request, res: Response) => {
    try {
      const userId = String(req.headers['x-scholarsync-user'] || 'guest_scholar').replace(
        /[^a-zA-Z0-9_-]/g,
        ''
      );
      const { session } = req.body || {};
      if (!session || !session.id) {
        res.status(400).json({ error: 'Invalid session object.' });
        return;
      }

      ensureDataStore();
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const store = JSON.parse(raw || '{"users":{}}');
      if (!store.users[userId]) {
        store.users[userId] = {};
      }
      store.users[userId][session.id] = {
        ...session,
        savedOnServerAt: new Date().toISOString()
      };
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store), 'utf-8');
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[ScholarSync Server Error]:', err?.message || err);
    res.status(500).json({
      error: 'AI service is temporarily unavailable. Please try again.'
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScholarSync AI Workspace running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
