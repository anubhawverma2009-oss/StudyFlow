import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  handleAnalyzeDocument,
  handleGenerateOrModifyNotes,
  handleTutorChat,
} from './server/services/geminiService';
import { optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  autosaveSessionState,
  createStudySessionWithDocument,
  deleteStudySessionClean,
  findExistingDocumentByHash,
  getFullStudySession,
  getUserStudyHistory,
  renameStudySession,
} from './src/db/studyRepository.ts';

const PORT = 3000;

async function startServer() {
  const app = express();

  // Handle large PDF base64 payloads up to 50MB
  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'StudyFlow Workspace API',
      database: 'Cloud SQL PostgreSQL',
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
    });
  });

  // =========================================================================
  // STUDY SESSIONS & HISTORY API (Cloud SQL PostgreSQL + Storage)
  // =========================================================================

  // 1. Get Study History for current user
  app.get('/api/history', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId || 'guest_user';
      const history = await getUserStudyHistory(userId);
      res.json({ history });
    } catch (error: any) {
      console.error('Error fetching study history:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch history' });
    }
  });

  // 2. Check for duplicate document before upload
  app.post('/api/documents/check-duplicate', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId || 'guest_user';
      const { fileHash } = req.body;
      if (!fileHash) {
        return res.json({ exists: false });
      }
      const existing = await findExistingDocumentByHash(userId, fileHash);
      if (existing) {
        return res.json({
          exists: true,
          documentId: existing.document.id,
          latestSessionId: existing.latestSessionId,
          title: existing.document.title,
        });
      }
      res.json({ exists: false });
    } catch (error: any) {
      res.json({ exists: false });
    }
  });

  // 3. Auto-Create Session & Store PDF Document
  app.post('/api/sessions/upload', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId || 'guest_user';
      const userEmail = req.userEmail || `${userId}@studyflow.app`;
      const userName = req.user?.name || (req.headers['x-user-name'] as string) || undefined;

      const { document, initialNotes } = req.body;
      if (!document || !document.title) {
        return res.status(400).json({ error: 'Valid document details required' });
      }

      const result = await createStudySessionWithDocument({
        userId,
        userEmail,
        userName,
        document,
        initialNotes,
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Error creating study session:', error);
      res.status(500).json({ error: error.message || 'Failed to create study session' });
    }
  });

  // 4. Fetch Full Study Session (Document, PDF, Messages, Notes, Versions)
  app.get('/api/sessions/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId || 'guest_user';
      const sessionData = await getFullStudySession(userId, req.params.id);
      if (!sessionData) {
        return res.status(404).json({ error: 'Study session not found' });
      }
      res.json(sessionData);
    } catch (error: any) {
      console.error('Error fetching study session:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch session' });
    }
  });

  // 5. Debounced Autosave (Current Page, Notes, Chat Messages, Versions)
  app.post('/api/sessions/:id/autosave', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId || 'guest_user';
      const result = await autosaveSessionState(userId, req.params.id, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error autosaving session state:', error);
      res.status(500).json({ error: error.message || 'Autosave failed' });
    }
  });

  // 6. Rename Study Session
  app.patch('/api/sessions/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId || 'guest_user';
      const { title } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      const result = await renameStudySession(userId, req.params.id, title.trim());
      res.json(result);
    } catch (error: any) {
      console.error('Error renaming study session:', error);
      res.status(500).json({ error: error.message || 'Failed to rename session' });
    }
  });

  // 7. Delete Study Session with Complete Resource Cleanup
  app.delete('/api/sessions/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId || 'guest_user';
      const result = await deleteStudySessionClean(userId, req.params.id);
      if (!result.success) {
        return res.status(404).json({ error: result.message || 'Failed to delete' });
      }
      res.json({ success: true, message: 'Study session and resources permanently deleted' });
    } catch (error: any) {
      console.error('Error deleting study session:', error);
      res.status(500).json({
        error: error.message || "Couldn't completely delete this study session. Please try again.",
      });
    }
  });

  // =========================================================================
  // AI ENDPOINTS (Gemini 2.5 Flash)
  // =========================================================================

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
        documentContext: documentContext.slice(0, 24000),
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
        pageImageBase64,
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
        pageImageBase64: typeof pageImageBase64 === 'string' ? pageImageBase64 : undefined,
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
        includedPages,
      } = req.body || {};

      const result = await handleGenerateOrModifyNotes({
        documentTitle: String(documentTitle || 'Study Document').slice(0, 200),
        subjectType: String(subjectType || 'general'),
        currentPage: Number(currentPage) || 1,
        selectedText: typeof selectedText === 'string' ? selectedText.slice(0, 3000) : undefined,
        instruction: String(instruction || 'Generate structured study notes.').slice(0, 2000),
        documentContext: String(documentContext || '').slice(0, 25000),
        includedPages: Array.isArray(includedPages) ? includedPages : [Number(currentPage) || 1],
        isFullGeneration: true,
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
        currentNotes,
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
        isFullGeneration: false,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[StudyFlow Server Error]:', err?.message || err);
    res.status(500).json({
      error: 'Service temporarily unavailable. Please try again.',
    });
  });

  // Vite middleware in development or static serve in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
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
    console.log(`StudyFlow AI Workspace running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
