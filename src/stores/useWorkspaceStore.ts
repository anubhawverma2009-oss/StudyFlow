import { create } from 'zustand';
import { AIService } from '../services/ai/aiClient';
import {
  HistoryItem,
  StudyApi,
} from '../services/api/studyApi.ts';
import {
  applyNoteModification,
  validateNoteModification,
} from '../services/notes/noteEngine';
import {
  processPdfBuffer,
  validatePdfFile,
} from '../services/pdf/pdfProcessor';
import {
  deleteSessionLocal,
  getActiveSessionIdLocal,
  getPanelLayoutLocal,
  getUserProfileLocal,
  loadAllSessionsLocal,
  loadPdfBytesFromIdb,
  saveActiveSessionIdLocal,
  savePanelLayoutLocal,
  savePdfBytesToIdb,
  saveSessionLocal,
  saveUserProfileLocal,
} from '../services/storage/sessionStorage';
import {
  AIMode,
  ChatMessage,
  MobileTab,
  NoteBlock,
  NoteSection,
  NotesDocument,
  NoteVersion,
  PanelLayoutConfig,
  QuickActionType,
  SaveStatus,
  StudySession,
  UserProfile,
  ZoomMode,
} from '../types/workspace';
import {
  arrayBufferToBase64,
  base64ToUint8Array,
  computeBufferHash,
} from '../utils/hash.ts';
import {
  createSampleStudySession,
  generateSamplePdfBytes,
  SampleDocKey,
} from '../utils/sampleDocuments';

interface WorkspaceStore {
  sessions: Record<string, StudySession>;
  activeSessionId: string;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  userProfile: UserProfile;

  // Study History
  historyList: HistoryItem[];
  isHistoryLoading: boolean;
  isHistorySidebarOpen: boolean;
  duplicateNotice: string | null;

  pdfBytes: Uint8Array | null;
  isProcessingPdf: boolean;
  processingStatusText: string;
  pdfError: string | null;
  zoomScale: number;
  zoomMode: ZoomMode;
  pdfSearchQuery: string;
  selectedPdfText: string;
  selectionPage: number | null;

  aiMode: AIMode;
  isAiGenerating: boolean;
  aiStatusText: string;
  aiError: string | null;
  abortController: AbortController | null;

  notesViewMode: 'rich' | 'markdown';
  highlightedSectionId: string | null;

  panelLayout: PanelLayoutConfig;
  fullscreenPanel: 'none' | 'pdf' | 'notes';
  mobileActiveTab: MobileTab;
  isShortcutsModalOpen: boolean;
  isSessionModalOpen: boolean;
  isAuthModalOpen: boolean;
  isVersionDrawerOpen: boolean;

  // History & Session Actions
  initializeWorkspace: () => Promise<void>;
  loadHistory: () => Promise<void>;
  startNewStudySession: () => Promise<void>;
  openHistorySession: (sessionId: string) => Promise<void>;
  renameHistorySession: (sessionId: string, newTitle: string) => Promise<void>;
  deleteHistorySession: (sessionId: string) => Promise<void>;
  setHistorySidebarOpen: (open: boolean) => void;
  clearDuplicateNotice: () => void;

  loadSampleDocument: (docKey: SampleDocKey) => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => void;
  uploadPdfFile: (file: File) => Promise<void>;
  clearWorkspaceForEmptyState: () => void;
  saveCurrentSessionNow: () => Promise<void>;

  setCurrentPage: (page: number) => void;
  setZoomScale: (scale: number) => void;
  setZoomMode: (mode: ZoomMode) => void;
  setPdfSearchQuery: (query: string) => void;
  setSelectedPdfText: (text: string, page?: number | null) => void;
  clearPdfError: () => void;

  setAiMode: (mode: AIMode) => void;
  sendMessage: (
    prompt: string,
    options?: {
      forceMode?: AIMode;
      quickAction?: QuickActionType;
      targetSectionHeading?: string;
      pageImageBase64?: string;
    }
  ) => Promise<void>;
  triggerGenerateNotes: (customInstruction?: string) => Promise<void>;
  addTextOrExplanationToNotes: (contentToAdd: string, sourceLabel?: string) => Promise<void>;
  stopAiGeneration: () => void;
  clearConversation: () => void;

  setNotesViewMode: (mode: 'rich' | 'markdown') => void;
  updateNotesDocumentManual: (updated: NotesDocument, versionLabel?: string) => void;
  updateSectionManual: (sectionId: string, updatedSection: NoteSection) => void;
  addCustomSectionManual: (heading: string, category?: NoteSection['category']) => void;
  deleteSectionManual: (sectionId: string) => void;
  moveSectionOrder: (sectionId: string, direction: 'up' | 'down') => void;
  addBlockToSectionManual: (sectionId: string, block: NoteBlock) => void;
  undoNotes: () => void;
  redoNotes: () => void;
  restoreNoteVersion: (index: number) => void;

  updatePanelLayout: (partial: Partial<PanelLayoutConfig>) => void;
  setFullscreenPanel: (panel: 'none' | 'pdf' | 'notes') => void;
  setMobileActiveTab: (tab: MobileTab) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setSessionModalOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  setVersionDrawerOpen: (open: boolean) => void;
  updateUserProfile: (profile: UserProfile) => void;
}

// Autosave timer
let autosaveTimeout: NodeJS.Timeout | null = null;
let retryTimeout: NodeJS.Timeout | null = null;

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  // Helper for immediate local state + debounced Cloud SQL autosave
  const persistSessionHelper = (session: StudySession, immediateBackend = false) => {
    saveSessionLocal(session);
    const all = { ...get().sessions, [session.id]: session };
    const nowIso = new Date().toISOString();
    set({
      sessions: all,
      saveStatus: 'saving',
      lastSavedAt: nowIso,
    });

    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
      autosaveTimeout = null;
    }

    const performBackendSave = async () => {
      try {
        await StudyApi.autosave(session.id, {
          currentPage: session.currentPage,
          title: session.document?.title || session.notes?.title,
          notes: session.notes
            ? {
                title: session.notes.title,
                subject: session.notes.subjectType,
                content: session.notes,
              }
            : undefined,
          newMessages: session.messages?.slice(-5).map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            metadata: { citedPages: m.citedPages },
          })),
          newVersion: session.noteVersions?.length
            ? {
                id: `ver_${session.id}_${session.noteVersions[session.noteVersions.length - 1].version}`,
                versionNumber: session.noteVersions[session.noteVersions.length - 1].version,
                label: session.noteVersions[session.noteVersions.length - 1].label,
                source: session.noteVersions[session.noteVersions.length - 1].source,
                snapshot: session.noteVersions[session.noteVersions.length - 1].snapshot,
              }
            : undefined,
        });

        set({ saveStatus: 'saved' });
        // Refresh history list silently in background
        get().loadHistory();
      } catch (err) {
        console.warn('Backend autosave delayed or failed, will retry:', err);
        set({ saveStatus: 'error' });
        // Schedule retry in 3 seconds
        if (!retryTimeout) {
          retryTimeout = setTimeout(() => {
            retryTimeout = null;
            persistSessionHelper(get().sessions[get().activeSessionId], true);
          }, 3000);
        }
      }
    };

    if (immediateBackend) {
      performBackendSave();
    } else {
      autosaveTimeout = setTimeout(performBackendSave, 1200);
    }
  };

  return {
    sessions: {},
    activeSessionId: '',
    saveStatus: 'saved',
    lastSavedAt: null,
    userProfile: getUserProfileLocal(),

    historyList: [],
    isHistoryLoading: false,
    isHistorySidebarOpen: true,
    duplicateNotice: null,

    pdfBytes: null,
    isProcessingPdf: false,
    processingStatusText: '',
    pdfError: null,
    zoomScale: 1.0,
    zoomMode: 'fit-width',
    pdfSearchQuery: '',
    selectedPdfText: '',
    selectionPage: null,

    aiMode: 'ask',
    isAiGenerating: false,
    aiStatusText: '',
    aiError: null,
    abortController: null,

    notesViewMode: 'rich',
    highlightedSectionId: null,

    panelLayout: getPanelLayoutLocal(),
    fullscreenPanel: 'none',
    mobileActiveTab: 'pdf',
    isShortcutsModalOpen: false,
    isSessionModalOpen: false,
    isAuthModalOpen: false,
    isVersionDrawerOpen: false,

    clearDuplicateNotice: () => set({ duplicateNotice: null }),

    setHistorySidebarOpen: (open: boolean) => set({ isHistorySidebarOpen: open }),

    loadHistory: async () => {
      set({ isHistoryLoading: true });
      try {
        const list = await StudyApi.getHistory();
        set({ historyList: list, isHistoryLoading: false });
      } catch (err) {
        console.warn('Failed to fetch study history:', err);
        set({ isHistoryLoading: false });
      }
    },

    initializeWorkspace: async () => {
      // 1. Fetch History from Cloud SQL
      await get().loadHistory();
      const history = get().historyList;

      // 2. Check last active session id
      const savedActiveId = getActiveSessionIdLocal();

      // If we have history records from database, restore the last active or latest
      if (history.length > 0) {
        const targetId =
          history.find((h) => h.id === savedActiveId)?.id || history[0].id;
        await get().openHistorySession(targetId);
        return;
      }

      // If local storage has sessions
      const localSessions = loadAllSessionsLocal();
      const localKeys = Object.keys(localSessions);
      if (localKeys.length > 0) {
        const targetId = savedActiveId && localSessions[savedActiveId] ? savedActiveId : localKeys[0];
        const targetSession = localSessions[targetId];
        set({
          sessions: localSessions,
          activeSessionId: targetId,
          lastSavedAt: targetSession.updatedAt,
        });

        const idbBytes = await loadPdfBytesFromIdb(targetSession.document.id);
        if (idbBytes) {
          set({ pdfBytes: idbBytes });
        } else if (targetSession.document.id.startsWith('doc_')) {
          const sampleKey = targetSession.document.id.replace('doc_', '') as SampleDocKey;
          if (['cs_fundamentals', 'calculus', 'python_dsa'].includes(sampleKey)) {
            const bytes = generateSamplePdfBytes(sampleKey);
            set({ pdfBytes: bytes });
            await savePdfBytesToIdb(targetSession.document.id, bytes);
          }
        }
      } else {
        // First-time visit: start with sample document
        const sampleSession = createSampleStudySession('cs_fundamentals');
        const bytes = generateSamplePdfBytes('cs_fundamentals');
        saveSessionLocal(sampleSession);
        await savePdfBytesToIdb(sampleSession.document.id, bytes);
        set({
          sessions: { [sampleSession.id]: sampleSession },
          activeSessionId: sampleSession.id,
          pdfBytes: bytes,
          lastSavedAt: sampleSession.updatedAt,
        });
      }
    },

    startNewStudySession: async () => {
      // 1. Autosave existing active session if present
      const { sessions, activeSessionId } = get();
      const current = sessions[activeSessionId];
      if (current) {
        persistSessionHelper(current, true);
      }

      // 2. Create fresh clean session
      const nowIso = new Date().toISOString();
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const emptyDoc = {
        id: `doc_empty_${Date.now()}`,
        title: 'New Study Document',
        fileName: 'No PDF Loaded',
        fileSize: 0,
        pageCount: 1,
        uploadedAt: nowIso,
        isScanned: false,
        subjectType: 'general' as const,
        pages: [],
        keyTopics: [],
      };

      const freshNotes: NotesDocument = {
        documentId: emptyDoc.id,
        title: 'Study Notes',
        subjectType: 'general',
        version: 1,
        updatedAt: nowIso,
        sections: [
          {
            id: `sec_initial_${Date.now()}`,
            heading: 'Study Notes',
            category: 'overview',
            pageRefs: [1],
            blocks: [
              {
                id: `blk_initial_${Date.now()}`,
                type: 'paragraph',
                content:
                  'Upload a PDF document to begin. Your AI tutor will help you understand concepts, answer questions, and build comprehensive notes.',
                pageRef: 1,
              },
            ],
          },
        ],
      };

      const freshSession: StudySession = {
        id: newSessionId,
        document: emptyDoc,
        currentPage: 1,
        messages: [
          {
            id: `msg_welcome_${Date.now()}`,
            role: 'assistant',
            mode: 'ask',
            responseType: 'EXPLANATION',
            content:
              'Welcome to your new study session! 🚀\n\nUpload a PDF using the left panel or drag-and-drop to get started. All your study progress, questions, and notes will be automatically saved to your History.',
            timestamp: nowIso,
          },
        ],
        notes: freshNotes,
        noteVersions: [
          {
            version: 1,
            timestamp: nowIso,
            label: 'v1: Fresh Session Created',
            source: 'initial',
            snapshot: JSON.parse(JSON.stringify(freshNotes)),
          },
        ],
        versionIndex: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      saveActiveSessionIdLocal(newSessionId);

      set((state) => ({
        sessions: { ...state.sessions, [newSessionId]: freshSession },
        activeSessionId: newSessionId,
        pdfBytes: null,
        selectedPdfText: '',
        pdfError: null,
        aiError: null,
        duplicateNotice: null,
      }));
    },

    openHistorySession: async (sessionId: string) => {
      if (!sessionId) return;
      if (get().activeSessionId === sessionId && get().pdfBytes) {
        return;
      }

      // Autosave current session if different
      const current = get().sessions[get().activeSessionId];
      if (current && current.id !== sessionId) {
        persistSessionHelper(current, true);
      }

      set({
        isProcessingPdf: true,
        processingStatusText: 'Loading study session from Cloud SQL...',
        pdfError: null,
        selectedPdfText: '',
        duplicateNotice: null,
      });

      try {
        const fullData = await StudyApi.getSession(sessionId);
        if (fullData && fullData.session) {
          const s = fullData.session;
          const d = fullData.document;
          const notesData = fullData.notes?.content || {
            documentId: d?.id || s.documentId,
            title: fullData.notes?.title || s.title,
            subjectType: fullData.notes?.subject || 'general',
            version: fullData.versions?.length || 1,
            updatedAt: s.updatedAt,
            sections: [],
          };

          const reconstructedSession: StudySession = {
            id: s.id,
            document: {
              id: d?.id || s.documentId || 'doc_unknown',
              title: d?.title || s.title,
              fileName: d?.fileName || 'Document.pdf',
              fileSize: d?.fileSize || 0,
              pageCount: d?.pageCount || 1,
              uploadedAt: d?.createdAt || s.createdAt,
              isScanned: !!d?.isScanned,
              subjectType: (fullData.notes?.subject || 'general') as any,
              pages: (fullData.chunks || []).map((c: any) => ({
                pageNumber: c.pageNumber,
                text: c.chunkText,
                headings: c.headings ? c.headings.split(';') : [],
                formulas: [],
                hasTables: false,
                wordCount: c.chunkText.split(/\s+/).length,
              })),
            },
            currentPage: s.currentPage || 1,
            messages: (fullData.messages || []).map((m: any) => ({
              id: m.id,
              role: m.role as any,
              content: m.content,
              timestamp: m.createdAt,
              citedPages: m.metadata?.citedPages || [],
            })),
            notes: notesData,
            noteVersions: (fullData.versions || []).map((v: any) => ({
              version: v.versionNumber,
              timestamp: v.createdAt,
              label: v.label,
              source: v.source as any,
              snapshot: v.snapshot,
            })),
            versionIndex: Math.max(0, (fullData.versions || []).length - 1),
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          };

          let bytes: Uint8Array | null = null;
          if (d?.pdfBase64) {
            bytes = base64ToUint8Array(d.pdfBase64);
            await savePdfBytesToIdb(d.id, bytes);
          } else {
            bytes = await loadPdfBytesFromIdb(d?.id || s.documentId);
          }

          saveActiveSessionIdLocal(sessionId);

          set((state) => ({
            sessions: { ...state.sessions, [sessionId]: reconstructedSession },
            activeSessionId: sessionId,
            pdfBytes: bytes,
            isProcessingPdf: false,
            processingStatusText: '',
            saveStatus: 'saved',
          }));
          return;
        }
      } catch (err) {
        console.warn('Backend fetch failed, checking local sessions:', err);
      }

      // Local fallback
      const local = get().sessions[sessionId];
      if (local) {
        set({
          activeSessionId: sessionId,
          isProcessingPdf: false,
          processingStatusText: '',
        });
        saveActiveSessionIdLocal(sessionId);
        const bytes = await loadPdfBytesFromIdb(local.document.id);
        set({ pdfBytes: bytes });
      } else {
        set({
          isProcessingPdf: false,
          processingStatusText: '',
          pdfError: 'Could not load the requested study session.',
        });
      }
    },

    renameHistorySession: async (sessionId: string, newTitle: string) => {
      try {
        await StudyApi.renameSession(sessionId, newTitle);
        // Update local session
        const session = get().sessions[sessionId];
        if (session) {
          const updated = {
            ...session,
            document: { ...session.document, title: newTitle },
            notes: { ...session.notes, title: `${newTitle} — Study Notes` },
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            sessions: { ...state.sessions, [sessionId]: updated },
          }));
        }
        await get().loadHistory();
      } catch (err: any) {
        console.error('Rename session failed:', err);
        throw err;
      }
    },

    deleteHistorySession: async (sessionId: string) => {
      try {
        await StudyApi.deleteSession(sessionId);

        // Remove from local sessions & storage
        const all = { ...get().sessions };
        delete all[sessionId];
        deleteSessionLocal(sessionId);

        await get().loadHistory();

        // If deleted session was active, switch to next available or start new
        if (get().activeSessionId === sessionId) {
          const remainingHistory = get().historyList;
          if (remainingHistory.length > 0) {
            await get().openHistorySession(remainingHistory[0].id);
          } else {
            await get().startNewStudySession();
          }
        }
      } catch (err: any) {
        console.error('Delete session failed:', err);
        throw err;
      }
    },

    loadSampleDocument: async (docKey: SampleDocKey) => {
      set({
        isProcessingPdf: true,
        processingStatusText: 'Loading sample academic document...',
        pdfError: null,
        selectedPdfText: '',
      });

      try {
        const session = createSampleStudySession(docKey);
        const bytes = generateSamplePdfBytes(docKey);
        await savePdfBytesToIdb(session.document.id, bytes);
        saveSessionLocal(session);

        // Also register in backend Cloud SQL
        const base64 = arrayBufferToBase64(bytes);
        try {
          await StudyApi.uploadSession({
            document: {
              id: session.document.id,
              title: session.document.title,
              fileName: session.document.fileName,
              fileSize: session.document.fileSize,
              fileType: 'application/pdf',
              fileHash: `sample_${docKey}`,
              pageCount: session.document.pageCount,
              extractedSummary: session.document.summary,
              pdfBase64: base64,
              chunks: session.document.pages.map((p) => ({
                pageNumber: p.pageNumber,
                chunkText: p.text,
                headings: p.headings.join(';'),
              })),
            },
            initialNotes: {
              id: `note_${session.id}`,
              title: session.notes.title,
              subject: session.notes.subjectType,
              content: session.notes,
            },
          });
          await get().loadHistory();
        } catch {
          // Ignore offline fallback
        }

        saveActiveSessionIdLocal(session.id);

        set((state) => ({
          sessions: { ...state.sessions, [session.id]: session },
          activeSessionId: session.id,
          pdfBytes: bytes,
          isProcessingPdf: false,
          processingStatusText: '',
          saveStatus: 'saved',
          lastSavedAt: session.updatedAt,
        }));
      } catch (err: any) {
        set({
          isProcessingPdf: false,
          processingStatusText: '',
          pdfError: err?.message || 'Failed to load sample PDF.',
        });
      }
    },

    switchSession: async (sessionId: string) => {
      await get().openHistorySession(sessionId);
    },

    deleteSession: (sessionId: string) => {
      get().deleteHistorySession(sessionId);
    },

    clearWorkspaceForEmptyState: () => {
      set({
        activeSessionId: '',
        pdfBytes: null,
        selectedPdfText: '',
        pdfError: null,
      });
    },

    uploadPdfFile: async (file: File) => {
      const validation = validatePdfFile(file);
      if (!validation.valid) {
        set({ pdfError: validation.error || 'Invalid PDF file.' });
        return;
      }

      set({
        isProcessingPdf: true,
        processingStatusText: 'Reading your PDF...',
        pdfError: null,
        selectedPdfText: '',
        duplicateNotice: null,
      });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // 1. Calculate SHA-256 fingerprint for Duplicate Detection
        const fileHash = await computeBufferHash(bytes);

        // 2. Check if user already uploaded this exact PDF
        const duplicateCheck = await StudyApi.checkDuplicate(fileHash);
        if (duplicateCheck.exists && duplicateCheck.latestSessionId) {
          set({
            isProcessingPdf: false,
            processingStatusText: '',
            duplicateNotice: `Identical PDF "${file.name}" detected in History. Reopened existing study session without duplicate storage.`,
          });
          await get().openHistorySession(duplicateCheck.latestSessionId);
          return;
        }

        // 3. Process PDF pages and text extraction
        const { metadata } = await processPdfBuffer(
          bytes,
          file.name,
          file.size,
          (current, total) => {
            set({
              processingStatusText: `Reading your PDF... (Page ${current} of ${total})`,
            });
          }
        );

        set({ processingStatusText: 'Storing in Cloud SQL & preparing AI study context...' });

        const nowIso = new Date().toISOString();
        const initialNotes: NotesDocument = {
          documentId: metadata.id,
          title: `${metadata.title} — Study Notes`,
          subjectType: metadata.subjectType,
          version: 1,
          updatedAt: nowIso,
          sections: [
            {
              id: `sec_ov_${Date.now()}`,
              heading: 'Overview',
              category: 'overview',
              pageRefs: [1],
              blocks: [
                {
                  id: `blk_ov_${Date.now()}`,
                  type: 'paragraph',
                  content: metadata.isScanned
                    ? `Uploaded "${metadata.fileName}" (${metadata.pageCount} pages). Note: This PDF appears to be image-based or scanned; text extraction may be limited.`
                    : `Uploaded "${metadata.fileName}" (${metadata.pageCount} pages, detected subject: ${metadata.subjectType}). Click "Generate Notes" above or use Change Notes mode to build comprehensive study notes from this PDF.`,
                  pageRef: 1,
                },
              ],
            },
          ],
        };

        const v1: NoteVersion = {
          version: 1,
          timestamp: nowIso,
          label: 'v1: Workspace Initialized',
          source: 'initial',
          snapshot: JSON.parse(JSON.stringify(initialNotes)),
        };

        const welcomeMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          mode: 'ask',
          responseType: 'EXPLANATION',
          content: metadata.isScanned
            ? `**PDF Ready:** *${metadata.fileName}* (${metadata.pageCount} pages).\n\n⚠️ **Notice:** This PDF appears to be image-based. Text extraction may be limited. You can still browse pages and ask questions.`
            : `**PDF Ready:** *${metadata.fileName}* (${metadata.pageCount} pages indexed).\n\nKey sections detected:\n${metadata.keyTopics
                ?.slice(0, 5)
                .map((t) => `- ${t}`)
                .join('\n')}\n\nAsk me to explain any page or concept in **Ask / Explain** mode, or click **Generate Notes** to build structured study notes.`,
          timestamp: nowIso,
          citedPages: [1],
        };

        // Convert to base64 for persistent database & storage
        const pdfBase64 = arrayBufferToBase64(bytes);

        // 4. Auto-save session and document in Cloud SQL PostgreSQL
        let assignedSessionId = `session_${Date.now()}`;
        try {
          const uploadRes = await StudyApi.uploadSession({
            document: {
              id: metadata.id,
              title: metadata.title,
              fileName: metadata.fileName,
              fileSize: metadata.fileSize,
              fileType: 'application/pdf',
              fileHash,
              pageCount: metadata.pageCount,
              extractedSummary: metadata.summary,
              isScanned: metadata.isScanned,
              pdfBase64,
              chunks: metadata.pages.map((p) => ({
                pageNumber: p.pageNumber,
                chunkText: p.text,
                headings: p.headings.join(';'),
              })),
            },
            initialNotes: {
              id: `note_${metadata.id}`,
              title: initialNotes.title,
              subject: initialNotes.subjectType,
              content: initialNotes,
            },
          });
          assignedSessionId = uploadRes.sessionId;
        } catch (uploadErr) {
          console.warn('Backend session upload failed, falling back to local storage:', uploadErr);
        }

        const newSession: StudySession = {
          id: assignedSessionId,
          document: metadata,
          currentPage: 1,
          messages: [welcomeMsg],
          notes: initialNotes,
          noteVersions: [v1],
          versionIndex: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await savePdfBytesToIdb(metadata.id, bytes);
        persistSessionHelper(newSession, true);
        saveActiveSessionIdLocal(assignedSessionId);

        // Reload history list so it appears immediately
        await get().loadHistory();

        set({
          activeSessionId: newSession.id,
          pdfBytes: bytes,
          isProcessingPdf: false,
          processingStatusText: '',
          saveStatus: 'saved',
        });
      } catch (err: any) {
        set({
          isProcessingPdf: false,
          processingStatusText: '',
          pdfError:
            'Could not read this PDF file. It may be corrupted, password-protected, or in an unsupported format.',
        });
      }
    },

    saveCurrentSessionNow: async () => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;
      persistSessionHelper(
        {
          ...active,
          updatedAt: new Date().toISOString(),
        },
        true
      );
    },

    setCurrentPage: (page: number) => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;
      const clamped = Math.max(1, Math.min(page, active.document.pageCount || 1));
      if (clamped === active.currentPage) return;

      const updated: StudySession = {
        ...active,
        currentPage: clamped,
        updatedAt: new Date().toISOString(),
      };
      persistSessionHelper(updated);
    },

    setZoomScale: (scale: number) => {
      const clamped = Math.max(0.5, Math.min(2.5, Number(scale.toFixed(2))));
      set({ zoomScale: clamped, zoomMode: 'custom' });
    },

    setZoomMode: (mode: ZoomMode) => {
      set({ zoomMode: mode });
    },

    setPdfSearchQuery: (query: string) => {
      set({ pdfSearchQuery: query });
    },

    setSelectedPdfText: (text: string, page?: number | null) => {
      set({
        selectedPdfText: text,
        selectionPage: page ?? get().sessions[get().activeSessionId]?.currentPage ?? 1,
      });
    },

    clearPdfError: () => set({ pdfError: null }),

    setAiMode: (mode: AIMode) => set({ aiMode: mode }),

    sendMessage: async (prompt: string, options = {}) => {
      const { sessions, activeSessionId, aiMode, abortController } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      if (abortController) {
        abortController.abort();
      }

      const effectiveMode: AIMode = options.forceMode || aiMode;
      const currentNotes = session.notes;
      const currentPage = session.currentPage;
      const selectedText = get().selectedPdfText;

      const userMsgId = `usr_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        mode: effectiveMode,
        content: prompt.trim(),
        timestamp: new Date().toISOString(),
        pageContext: currentPage,
        selectedTextContext: selectedText ? selectedText.slice(0, 500) : undefined,
      };

      const updatedMessagesWithUser = [...session.messages, userMsg];
      const sessionWithUser: StudySession = {
        ...session,
        messages: updatedMessagesWithUser,
        updatedAt: new Date().toISOString(),
      };

      persistSessionHelper(sessionWithUser);

      const controller = new AbortController();
      set({
        isAiGenerating: true,
        aiStatusText:
          effectiveMode === 'change_notes'
            ? 'Updating your notes...'
            : 'Analyzing study document...',
        aiError: null,
        abortController: controller,
      });

      try {
        const response = await AIService.sendMessage({
          prompt,
          mode: effectiveMode,
          quickAction: options.quickAction,
          document: session.document,
          currentPage,
          selectedText,
          currentNotes,
          recentMessages: session.messages,
          targetSectionHeading: options.targetSectionHeading,
          pageImageBase64: options.pageImageBase64,
          signal: controller.signal,
        });

        let updatedNotes = session.notes;
        let updatedVersions = session.noteVersions;
        let newVersionIndex = session.versionIndex;

        if (response.type === 'NOTE_MODIFICATION' && response.noteModification) {
          const mod = response.noteModification;
          const validated = validateNoteModification(mod);
          if (validated.valid && validated.normalized) {
            const applyRes = applyNoteModification(session.notes, validated.normalized);
            updatedNotes = applyRes.updatedNotes;
            const newVerNumber = (session.notes.version || 1) + 1;
            const newVersion: NoteVersion = {
              version: newVerNumber,
              timestamp: new Date().toISOString(),
              label: `v${newVerNumber}: ${mod.summary || 'AI Notes Update'}`,
              source: 'ai',
              snapshot: JSON.parse(JSON.stringify(updatedNotes)),
            };
            updatedVersions = [...session.noteVersions, newVersion];
            newVersionIndex = updatedVersions.length - 1;
          }
        }

        const assistantMsg: ChatMessage = {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          mode: effectiveMode,
          responseType: response.type,
          content: response.content,
          timestamp: new Date().toISOString(),
          citedPages: response.citedPages || [currentPage],
          noteChangeSummary:
            response.type === 'NOTE_MODIFICATION' && response.noteModification
              ? {
                  operation: response.noteModification.operation,
                  targetSection: response.noteModification.targetSectionHeading || '',
                  versionCreated: updatedNotes.version,
                  reason: response.noteModification.summary || '',
                }
              : undefined,
        };

        const finalSession: StudySession = {
          ...session,
          messages: [...updatedMessagesWithUser, assistantMsg],
          notes: updatedNotes,
          noteVersions: updatedVersions,
          versionIndex: newVersionIndex,
          updatedAt: new Date().toISOString(),
        };

        persistSessionHelper(finalSession);

        set({
          isAiGenerating: false,
          aiStatusText: '',
          abortController: null,
          selectedPdfText: '',
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          set({
            isAiGenerating: false,
            aiStatusText: '',
            abortController: null,
          });
          return;
        }

        const errorMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          role: 'assistant',
          mode: effectiveMode,
          content:
            err?.message ||
            'I encountered an issue processing your study request. Please verify your connection and try again.',
          timestamp: new Date().toISOString(),
          isError: true,
          retryPayload: {
            prompt,
            mode: effectiveMode,
            quickAction: options.quickAction,
            pageImageBase64: options.pageImageBase64,
          },
        };

        const errorSession: StudySession = {
          ...session,
          messages: [...updatedMessagesWithUser, errorMsg],
          updatedAt: new Date().toISOString(),
        };

        persistSessionHelper(errorSession);

        set({
          isAiGenerating: false,
          aiStatusText: '',
          aiError: err?.message || 'Error communicating with AI service.',
          abortController: null,
        });
      }
    },

    triggerGenerateNotes: async (customInstruction?: string) => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const instruction =
        customInstruction ||
        `Generate comprehensive, structured academic study notes for "${session.document.title}". Include key definitions, formulas, worked examples, bullet points, and exam takeaways.`;

      await get().sendMessage(instruction, {
        forceMode: 'change_notes',
        quickAction: 'make_notes',
      });
    },

    addTextOrExplanationToNotes: async (contentToAdd: string, sourceLabel?: string) => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const currentNotes = session.notes;
      const targetSec = currentNotes.sections[0] || {
        id: `sec_add_${Date.now()}`,
        heading: 'Key Notes & Insights',
        category: 'key_takeaways' as const,
        pageRefs: [session.currentPage],
        blocks: [],
      };

      const newBlock: NoteBlock = {
        id: `blk_add_${Date.now()}`,
        type: 'callout',
        content: contentToAdd,
        calloutType: 'info',
        calloutTitle: sourceLabel || `Note from Page ${session.currentPage}`,
        pageRef: session.currentPage,
      };

      const updatedSections = currentNotes.sections.map((sec) =>
        sec.id === targetSec.id ? { ...sec, blocks: [...sec.blocks, newBlock] } : sec
      );

      if (!currentNotes.sections.some((s) => s.id === targetSec.id)) {
        updatedSections.push({ ...targetSec, blocks: [newBlock] });
      }

      const updatedNotes: NotesDocument = {
        ...currentNotes,
        version: currentNotes.version + 1,
        updatedAt: new Date().toISOString(),
        sections: updatedSections,
      };

      const newVer: NoteVersion = {
        version: updatedNotes.version,
        timestamp: new Date().toISOString(),
        label: `v${updatedNotes.version}: Added insight to notes`,
        source: 'manual',
        snapshot: JSON.parse(JSON.stringify(updatedNotes)),
      };

      const updatedSession: StudySession = {
        ...session,
        notes: updatedNotes,
        noteVersions: [...session.noteVersions, newVer],
        versionIndex: session.noteVersions.length,
        updatedAt: new Date().toISOString(),
      };

      persistSessionHelper(updatedSession);
    },

    stopAiGeneration: () => {
      const { abortController } = get();
      if (abortController) {
        abortController.abort();
        set({
          isAiGenerating: false,
          aiStatusText: '',
          abortController: null,
        });
      }
    },

    clearConversation: () => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;
      const updated: StudySession = {
        ...active,
        messages: [],
        updatedAt: new Date().toISOString(),
      };
      persistSessionHelper(updated);
    },

    setNotesViewMode: (mode: 'rich' | 'markdown') => {
      set({ notesViewMode: mode });
    },

    updateNotesDocumentManual: (updated: NotesDocument, versionLabel?: string) => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const newVerNumber = (session.notes.version || 1) + 1;
      const newVersion: NoteVersion = {
        version: newVerNumber,
        timestamp: new Date().toISOString(),
        label: versionLabel || `v${newVerNumber}: Manual edit`,
        source: 'manual',
        snapshot: JSON.parse(JSON.stringify(updated)),
      };

      const updatedDoc = {
        ...updated,
        version: newVerNumber,
        updatedAt: new Date().toISOString(),
      };

      const updatedSession: StudySession = {
        ...session,
        notes: updatedDoc,
        noteVersions: [...session.noteVersions, newVersion],
        versionIndex: session.noteVersions.length,
        updatedAt: new Date().toISOString(),
      };

      persistSessionHelper(updatedSession);
    },

    updateSectionManual: (sectionId: string, updatedSection: NoteSection) => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const newSections = session.notes.sections.map((s) =>
        s.id === sectionId ? updatedSection : s
      );

      get().updateNotesDocumentManual(
        {
          ...session.notes,
          sections: newSections,
        },
        `Edited ${updatedSection.heading}`
      );
    },

    addCustomSectionManual: (heading: string, category: NoteSection['category'] = 'custom') => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const newSection: NoteSection = {
        id: `sec_${Date.now()}`,
        heading: heading.trim() || 'New Section',
        category,
        pageRefs: [session.currentPage],
        blocks: [
          {
            id: `blk_${Date.now()}`,
            type: 'paragraph',
            content: 'Write notes here...',
            pageRef: session.currentPage,
          },
        ],
      };

      get().updateNotesDocumentManual(
        {
          ...session.notes,
          sections: [...session.notes.sections, newSection],
        },
        `Added section "${newSection.heading}"`
      );
    },

    deleteSectionManual: (sectionId: string) => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const target = session.notes.sections.find((s) => s.id === sectionId);
      const newSections = session.notes.sections.filter((s) => s.id !== sectionId);

      get().updateNotesDocumentManual(
        {
          ...session.notes,
          sections: newSections,
        },
        `Deleted section "${target?.heading || 'Section'}"`
      );
    },

    moveSectionOrder: (sectionId: string, direction: 'up' | 'down') => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const index = session.notes.sections.findIndex((s) => s.id === sectionId);
      if (index === -1) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === session.notes.sections.length - 1) return;

      const newSections = [...session.notes.sections];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const [removed] = newSections.splice(index, 1);
      newSections.splice(targetIndex, 0, removed);

      get().updateNotesDocumentManual(
        {
          ...session.notes,
          sections: newSections,
        },
        `Reordered sections`
      );
    },

    addBlockToSectionManual: (sectionId: string, block: NoteBlock) => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const newSections = session.notes.sections.map((s) =>
        s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s
      );

      get().updateNotesDocumentManual(
        {
          ...session.notes,
          sections: newSections,
        },
        `Added ${block.type} block`
      );
    },

    undoNotes: () => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session || session.versionIndex <= 0) return;

      const targetIndex = session.versionIndex - 1;
      const targetVersion = session.noteVersions[targetIndex];
      if (!targetVersion) return;

      const updatedSession: StudySession = {
        ...session,
        notes: JSON.parse(JSON.stringify(targetVersion.snapshot)),
        versionIndex: targetIndex,
        updatedAt: new Date().toISOString(),
      };

      persistSessionHelper(updatedSession);
    },

    redoNotes: () => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session || session.versionIndex >= session.noteVersions.length - 1) return;

      const targetIndex = session.versionIndex + 1;
      const targetVersion = session.noteVersions[targetIndex];
      if (!targetVersion) return;

      const updatedSession: StudySession = {
        ...session,
        notes: JSON.parse(JSON.stringify(targetVersion.snapshot)),
        versionIndex: targetIndex,
        updatedAt: new Date().toISOString(),
      };

      persistSessionHelper(updatedSession);
    },

    restoreNoteVersion: (index: number) => {
      const { sessions, activeSessionId } = get();
      const session = sessions[activeSessionId];
      if (!session) return;

      const target = session.noteVersions[index];
      if (!target) return;

      const newVerNum = session.notes.version + 1;
      const restoredDoc: NotesDocument = {
        ...JSON.parse(JSON.stringify(target.snapshot)),
        version: newVerNum,
        updatedAt: new Date().toISOString(),
      };

      const newVersion: NoteVersion = {
        version: newVerNum,
        timestamp: new Date().toISOString(),
        label: `v${newVerNum}: Restored from v${target.version}`,
        source: 'manual',
        snapshot: JSON.parse(JSON.stringify(restoredDoc)),
      };

      const updatedSession: StudySession = {
        ...session,
        notes: restoredDoc,
        noteVersions: [...session.noteVersions, newVersion],
        versionIndex: session.noteVersions.length,
        updatedAt: new Date().toISOString(),
      };

      persistSessionHelper(updatedSession, true);
    },

    updatePanelLayout: (partial: Partial<PanelLayoutConfig>) => {
      const updated = { ...get().panelLayout, ...partial };
      savePanelLayoutLocal(updated);
      set({ panelLayout: updated });
    },

    setFullscreenPanel: (panel: 'none' | 'pdf' | 'notes') => {
      set({ fullscreenPanel: panel });
    },

    setMobileActiveTab: (tab: MobileTab) => {
      set({ mobileActiveTab: tab });
    },

    setShortcutsModalOpen: (open: boolean) => set({ isShortcutsModalOpen: open }),
    setSessionModalOpen: (open: boolean) => set({ isSessionModalOpen: open }),
    setAuthModalOpen: (open: boolean) => set({ isAuthModalOpen: open }),
    setVersionDrawerOpen: (open: boolean) => set({ isVersionDrawerOpen: open }),

    updateUserProfile: (profile: UserProfile) => {
      saveUserProfileLocal(profile);
      set({ userProfile: profile });
    },
  };
});
