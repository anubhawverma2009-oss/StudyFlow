import { create } from 'zustand';
import { AIService } from '../services/ai/aiClient';
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
  loadAllSessionsLocal,
  loadPanelLayout,
  loadPdfBytesFromIdb,
  loadUserProfile,
  PanelLayoutConfig,
  savePanelLayout,
  savePdfBytesToIdb,
  saveSessionLocal,
  saveUserProfile,
  syncSessionToServer,
} from '../services/storage/sessionStorage';
import {
  AIMode,
  ChatMessage,
  NoteBlock,
  NoteModificationPayload,
  NotesDocument,
  NoteSection,
  NoteVersion,
  QuickActionType,
  SaveStatus,
  StudySession,
  UserProfile,
  ZoomMode,
} from '../types/workspace';
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
  mobileActiveTab: 'pdf' | 'chat' | 'notes';
  isShortcutsModalOpen: boolean;
  isSessionModalOpen: boolean;
  isAuthModalOpen: boolean;
  isVersionDrawerOpen: boolean;

  initializeWorkspace: () => Promise<void>;
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
  setMobileActiveTab: (tab: 'pdf' | 'chat' | 'notes') => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setSessionModalOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  setVersionDrawerOpen: (open: boolean) => void;
  updateUserProfile: (profile: UserProfile) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  const persistSessionHelper = (session: StudySession) => {
    set({ saveStatus: 'saving' });
    saveSessionLocal(session);
    const all = { ...get().sessions, [session.id]: session };
    const nowIso = new Date().toISOString();
    set({
      sessions: all,
      saveStatus: 'saved',
      lastSavedAt: nowIso
    });
    syncSessionToServer(session, get().userProfile.id).catch(() => {});
  };

  const initialSample = createSampleStudySession('cs_fundamentals');

  return {
    sessions: { [initialSample.id]: initialSample },
    activeSessionId: initialSample.id,
    saveStatus: 'saved',
    lastSavedAt: initialSample.updatedAt,
    userProfile: loadUserProfile(),

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

    panelLayout: loadPanelLayout(),
    fullscreenPanel: 'none',
    mobileActiveTab: 'pdf',
    isShortcutsModalOpen: false,
    isSessionModalOpen: false,
    isAuthModalOpen: false,
    isVersionDrawerOpen: false,

    initializeWorkspace: async () => {
      const storedSessions = loadAllSessionsLocal();
      const storedActiveId = getActiveSessionIdLocal();

      if (Object.keys(storedSessions).length > 0) {
        const targetId =
          storedActiveId && storedSessions[storedActiveId]
            ? storedActiveId
            : Object.keys(storedSessions)[0];
        const targetSession = storedSessions[targetId];
        set({
          sessions: storedSessions,
          activeSessionId: targetId,
          lastSavedAt: targetSession.updatedAt
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
        const sampleSession = createSampleStudySession('cs_fundamentals');
        const bytes = generateSamplePdfBytes('cs_fundamentals');
        saveSessionLocal(sampleSession);
        await savePdfBytesToIdb(sampleSession.document.id, bytes);
        set({
          sessions: { [sampleSession.id]: sampleSession },
          activeSessionId: sampleSession.id,
          pdfBytes: bytes,
          lastSavedAt: sampleSession.updatedAt
        });
      }
    },

    loadSampleDocument: async (docKey: SampleDocKey) => {
      set({
        isProcessingPdf: true,
        processingStatusText: 'Reading your PDF...',
        pdfError: null,
        selectedPdfText: ''
      });

      try {
        const session = createSampleStudySession(docKey);
        const bytes = generateSamplePdfBytes(docKey);
        await savePdfBytesToIdb(session.document.id, bytes);
        saveSessionLocal(session);

        set((state) => ({
          sessions: { ...state.sessions, [session.id]: session },
          activeSessionId: session.id,
          pdfBytes: bytes,
          isProcessingPdf: false,
          processingStatusText: '',
          saveStatus: 'saved',
          lastSavedAt: session.updatedAt
        }));
      } catch (err: any) {
        set({
          isProcessingPdf: false,
          processingStatusText: '',
          pdfError: err?.message || 'Failed to load sample PDF.'
        });
      }
    },

    switchSession: async (sessionId: string) => {
      const target = get().sessions[sessionId];
      if (!target) return;

      set({
        activeSessionId: sessionId,
        selectedPdfText: '',
        pdfError: null,
        aiError: null
      });

      const idbBytes = await loadPdfBytesFromIdb(target.document.id);
      if (idbBytes) {
        set({ pdfBytes: idbBytes });
      } else if (target.document.id.startsWith('doc_')) {
        const key = target.document.id.replace('doc_', '') as SampleDocKey;
        if (['cs_fundamentals', 'calculus', 'python_dsa'].includes(key)) {
          const bytes = generateSamplePdfBytes(key);
          set({ pdfBytes: bytes });
        }
      } else {
        set({ pdfBytes: null });
      }
    },

    deleteSession: (sessionId: string) => {
      const all = { ...get().sessions };
      if (Object.keys(all).length <= 1) return;
      delete all[sessionId];
      deleteSessionLocal(sessionId);
      const nextId = Object.keys(all)[0];
      set({ sessions: all });
      get().switchSession(nextId);
    },

    clearWorkspaceForEmptyState: () => {
      set({
        activeSessionId: '',
        pdfBytes: null,
        selectedPdfText: '',
        pdfError: null
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
        selectedPdfText: ''
      });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const { metadata } = await processPdfBuffer(
          bytes,
          file.name,
          file.size,
          (current, total) => {
            set({
              processingStatusText: `Reading your PDF... (Page ${current} of ${total})`
            });
          }
        );

        set({ processingStatusText: 'Indexing pages and preparing AI study context...' });

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
                  pageRef: 1
                }
              ]
            }
          ]
        };

        const v1: NoteVersion = {
          version: 1,
          timestamp: nowIso,
          label: 'v1: Workspace Initialized',
          source: 'initial',
          snapshot: JSON.parse(JSON.stringify(initialNotes))
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
          citedPages: [1]
        };

        const newSession: StudySession = {
          id: `session_${Date.now()}`,
          document: metadata,
          currentPage: 1,
          messages: [welcomeMsg],
          notes: initialNotes,
          noteVersions: [v1],
          versionIndex: 0,
          createdAt: nowIso,
          updatedAt: nowIso
        };

        await savePdfBytesToIdb(metadata.id, bytes);
        persistSessionHelper(newSession);

        set({
          activeSessionId: newSession.id,
          pdfBytes: bytes,
          isProcessingPdf: false,
          processingStatusText: ''
        });
      } catch (err: any) {
        set({
          isProcessingPdf: false,
          processingStatusText: '',
          pdfError:
            'Could not read this PDF file. It may be corrupted, password-protected, or in an unsupported format.'
        });
      }
    },

    saveCurrentSessionNow: async () => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;
      persistSessionHelper({
        ...active,
        updatedAt: new Date().toISOString()
      });
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
        updatedAt: new Date().toISOString()
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
        selectionPage: page ?? get().sessions[get().activeSessionId]?.currentPage ?? 1
      });
    },

    clearPdfError: () => set({ pdfError: null }),

    setAiMode: (mode: AIMode) => set({ aiMode: mode, aiError: null }),

    stopAiGeneration: () => {
      const ctrl = get().abortController;
      if (ctrl) {
        ctrl.abort();
      }
      set({
        isAiGenerating: false,
        aiStatusText: '',
        abortController: null
      });
    },

    clearConversation: () => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const clearedSession: StudySession = {
        ...active,
        messages: [
          {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            mode: 'ask',
            content: `Conversation cleared for **${active.document.title}**. Your notes in the right panel remain untouched. How can I help you with **Page ${active.currentPage}**?`,
            timestamp: new Date().toISOString(),
            citedPages: [active.currentPage]
          }
        ],
        updatedAt: new Date().toISOString()
      };
      persistSessionHelper(clearedSession);
    },

    sendMessage: async (prompt, options) => {
      const trimmed = prompt.trim();
      if (!trimmed || get().isAiGenerating) return;

      const { sessions, activeSessionId, aiMode, selectedPdfText } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const effectiveMode: AIMode = options?.forceMode || aiMode;
      const nowIso = new Date().toISOString();

      const userMsg: ChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        mode: effectiveMode,
        content: trimmed,
        timestamp: nowIso,
        pageContext: active.currentPage,
        selectedTextContext: selectedPdfText ? selectedPdfText.slice(0, 300) : undefined
      };

      const sessionWithUserMsg: StudySession = {
        ...active,
        messages: [...active.messages, userMsg],
        updatedAt: nowIso
      };

      const abortController = new AbortController();
      set({
        sessions: { ...sessions, [activeSessionId]: sessionWithUserMsg },
        isAiGenerating: true,
        aiError: null,
        abortController,
        aiStatusText:
          effectiveMode === 'change_notes'
            ? 'Analyzing current notes and applying structured update...'
            : `Consulting Page ${active.currentPage} context...`
      });

      try {
        if (effectiveMode === 'ask') {
          const result = await AIService.chat({
            document: active.document,
            currentPage: active.currentPage,
            selectedText: selectedPdfText || undefined,
            userMessage: trimmed,
            recentMessages: active.messages,
            quickAction: options?.quickAction,
            pageImageBase64: options?.pageImageBase64,
            signal: abortController.signal
          });

          const aiMsg: ChatMessage = {
            id: `msg_a_${Date.now()}`,
            role: 'assistant',
            mode: 'ask',
            responseType: result.responseType || 'CHAT_RESPONSE',
            content: result.reply,
            timestamp: new Date().toISOString(),
            pageContext: active.currentPage,
            citedPages: result.citedPages
          };

          const currentActive = get().sessions[activeSessionId];
          const finalSession: StudySession = {
            ...currentActive,
            messages: [...currentActive.messages, aiMsg],
            updatedAt: new Date().toISOString()
          };

          persistSessionHelper(finalSession);
          set({
            isAiGenerating: false,
            aiStatusText: '',
            abortController: null
          });
        } else {
          const result = await AIService.modifyNotes({
            document: active.document,
            currentPage: active.currentPage,
            selectedText: selectedPdfText || undefined,
            currentNotes: active.notes,
            instruction: trimmed,
            targetSectionHeading: options?.targetSectionHeading,
            signal: abortController.signal
          });

          const validation = validateNoteModification(result.modification);
          if (!validation.valid || !validation.normalized) {
            throw new Error(
              validation.error ||
                'AI returned an invalid note structure. Your existing notes were protected and not modified.'
            );
          }

          const { updatedNotes, targetSectionName } = applyNoteModification(
            active.notes,
            validation.normalized
          );

          const newVersionNumber = updatedNotes.version;
          const versionSnapshot: NoteVersion = {
            version: newVersionNumber,
            timestamp: new Date().toISOString(),
            label: `v${newVersionNumber}: AI ${
              validation.normalized.operation === 'replace_all'
                ? 'Restructured Notes'
                : `Updated "${targetSectionName}"`
            }`,
            source: 'ai',
            snapshot: JSON.parse(JSON.stringify(updatedNotes))
          };

          const nextVersions = [
            ...active.noteVersions.slice(0, active.versionIndex + 1),
            versionSnapshot
          ];

          const aiMsg: ChatMessage = {
            id: `msg_a_${Date.now()}`,
            role: 'assistant',
            mode: 'change_notes',
            responseType: 'NOTE_MODIFICATION',
            content:
              result.reply ||
              validation.normalized.summaryOfChanges ||
              `Updated **${targetSectionName}** in your notes.`,
            timestamp: new Date().toISOString(),
            pageContext: active.currentPage,
            citedPages: result.citedPages,
            noteChangeSummary: {
              operation: validation.normalized.operation,
              targetSection: targetSectionName,
              versionCreated: newVersionNumber,
              reason: validation.normalized.reason
            }
          };

          const currentActive = get().sessions[activeSessionId];
          const finalSession: StudySession = {
            ...currentActive,
            messages: [...currentActive.messages, aiMsg],
            notes: updatedNotes,
            noteVersions: nextVersions,
            versionIndex: nextVersions.length - 1,
            updatedAt: new Date().toISOString()
          };

          persistSessionHelper(finalSession);
          set({
            isAiGenerating: false,
            aiStatusText: '',
            abortController: null,
            mobileActiveTab: 'notes'
          });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          set({ isAiGenerating: false, aiStatusText: '', abortController: null });
          return;
        }

        const errMsg: ChatMessage = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          mode: effectiveMode,
          content:
            err?.message ||
            'AI is temporarily unavailable. Please try again. Your existing notes were not altered.',
          timestamp: new Date().toISOString(),
          isError: true,
          retryPayload: {
            prompt: trimmed,
            mode: effectiveMode,
            quickAction: options?.quickAction,
            pageImageBase64: options?.pageImageBase64
          }
        };

        const currentActive = get().sessions[activeSessionId];
        if (currentActive) {
          const updatedSession: StudySession = {
            ...currentActive,
            messages: [...currentActive.messages, errMsg],
            updatedAt: new Date().toISOString()
          };
          persistSessionHelper(updatedSession);
        }

        set({
          isAiGenerating: false,
          aiStatusText: '',
          abortController: null,
          aiError: err?.message || 'AI request failed.'
        });
      }
    },

    triggerGenerateNotes: async (customInstruction?: string) => {
      if (get().isAiGenerating) return;
      const { sessions, activeSessionId, selectedPdfText } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const abortController = new AbortController();
      const instruction =
        customInstruction ||
        `Generate structured, exam-oriented study notes for "${active.document.title}" (focusing on Page ${active.currentPage} and core document concepts).`;

      const userMsg: ChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        mode: 'change_notes',
        content: customInstruction || 'Generate structured study notes from this PDF.',
        timestamp: new Date().toISOString(),
        pageContext: active.currentPage
      };

      set({
        sessions: {
          ...sessions,
          [activeSessionId]: {
            ...active,
            messages: [...active.messages, userMsg]
          }
        },
        isAiGenerating: true,
        aiError: null,
        abortController,
        aiStatusText: 'Generating structured study notes from PDF...'
      });

      try {
        const result = await AIService.generateNotes({
          document: active.document,
          currentPage: active.currentPage,
          selectedText: selectedPdfText || undefined,
          customInstruction: instruction,
          signal: abortController.signal
        });

        const validation = validateNoteModification(result.modification);
        if (!validation.valid || !validation.normalized) {
          throw new Error(
            validation.error || 'Failed to validate generated notes structure.'
          );
        }

        const { updatedNotes } = applyNoteModification(
          active.notes,
          validation.normalized
        );

        const newVersionNumber = updatedNotes.version;
        const versionSnapshot: NoteVersion = {
          version: newVersionNumber,
          timestamp: new Date().toISOString(),
          label: `v${newVersionNumber}: AI Generated Study Notes`,
          source: 'ai',
          snapshot: JSON.parse(JSON.stringify(updatedNotes))
        };

        const nextVersions = [
          ...active.noteVersions.slice(0, active.versionIndex + 1),
          versionSnapshot
        ];

        const aiMsg: ChatMessage = {
          id: `msg_a_${Date.now()}`,
          role: 'assistant',
          mode: 'change_notes',
          responseType: 'NOTE_GENERATION',
          content:
            result.reply ||
            `Generated structured study notes (${updatedNotes.sections.length} sections) grounded in **${active.document.title}**.`,
          timestamp: new Date().toISOString(),
          citedPages: result.citedPages,
          noteChangeSummary: {
            operation: 'replace_all',
            targetSection: `All Sections (${updatedNotes.sections.length})`,
            versionCreated: newVersionNumber,
            reason: 'Generated structured subject-adapted study notes from PDF.'
          }
        };

        const currentActive = get().sessions[activeSessionId];
        const finalSession: StudySession = {
          ...currentActive,
          messages: [...currentActive.messages, aiMsg],
          notes: updatedNotes,
          noteVersions: nextVersions,
          versionIndex: nextVersions.length - 1,
          updatedAt: new Date().toISOString()
        };

        persistSessionHelper(finalSession);
        set({
          isAiGenerating: false,
          aiStatusText: '',
          abortController: null,
          mobileActiveTab: 'notes'
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          set({ isAiGenerating: false, aiStatusText: '', abortController: null });
          return;
        }
        set({
          isAiGenerating: false,
          aiStatusText: '',
          abortController: null,
          aiError: err?.message || 'Could not generate notes. Please retry.'
        });
      }
    },

    addTextOrExplanationToNotes: async (contentToAdd: string, sourceLabel?: string) => {
      const instruction = `Convert the following ${
        sourceLabel || 'selected study passage'
      } into clean, structured study notes and insert or append it into the most appropriate section of my existing notes without deleting my other sections:\n\n"""\n${contentToAdd}\n"""`;

      await get().sendMessage(instruction, {
        forceMode: 'change_notes'
      });
    },

    setNotesViewMode: (mode) => set({ notesViewMode: mode }),

    updateNotesDocumentManual: (updated: NotesDocument, versionLabel = 'Manual Edit') => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const nextVer = active.notes.version + 1;
      const stamped: NotesDocument = {
        ...updated,
        version: nextVer,
        updatedAt: new Date().toISOString()
      };

      const vEntry: NoteVersion = {
        version: nextVer,
        timestamp: stamped.updatedAt,
        label: `v${nextVer}: ${versionLabel}`,
        source: 'manual',
        snapshot: JSON.parse(JSON.stringify(stamped))
      };

      const nextVersions = [
        ...active.noteVersions.slice(0, active.versionIndex + 1),
        vEntry
      ];

      const updatedSession: StudySession = {
        ...active,
        notes: stamped,
        noteVersions: nextVersions,
        versionIndex: nextVersions.length - 1,
        updatedAt: stamped.updatedAt
      };

      persistSessionHelper(updatedSession);
    },

    updateSectionManual: (sectionId: string, updatedSection: NoteSection) => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const nextSections = active.notes.sections.map((s) =>
        s.id === sectionId ? updatedSection : s
      );

      get().updateNotesDocumentManual(
        {
          ...active.notes,
          sections: nextSections
        },
        `Edited "${updatedSection.heading}"`
      );
    },

    addCustomSectionManual: (heading: string, category = 'custom') => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const newSec: NoteSection = {
        id: `sec_${Date.now()}`,
        heading: heading.trim() || 'New Section',
        category,
        pageRefs: [active.currentPage],
        blocks: [
          {
            id: `blk_${Date.now()}`,
            type: 'paragraph',
            content: 'Click here to edit your notes for this section...',
            pageRef: active.currentPage
          }
        ]
      };

      get().updateNotesDocumentManual(
        {
          ...active.notes,
          sections: [...active.notes.sections, newSec]
        },
        `Added Section "${newSec.heading}"`
      );
    },

    deleteSectionManual: (sectionId: string) => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active || active.notes.sections.length <= 1) return;

      const target = active.notes.sections.find((s) => s.id === sectionId);
      const nextSections = active.notes.sections.filter((s) => s.id !== sectionId);

      get().updateNotesDocumentManual(
        {
          ...active.notes,
          sections: nextSections
        },
        `Removed "${target?.heading || 'Section'}"`
      );
    },

    moveSectionOrder: (sectionId: string, direction: 'up' | 'down') => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const secs = [...active.notes.sections];
      const idx = secs.findIndex((s) => s.id === sectionId);
      if (idx === -1) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= secs.length) return;

      const temp = secs[idx];
      secs[idx] = secs[swapIdx];
      secs[swapIdx] = temp;

      get().updateNotesDocumentManual(
        {
          ...active.notes,
          sections: secs
        },
        `Reordered "${temp.heading}"`
      );
    },

    addBlockToSectionManual: (sectionId: string, block: NoteBlock) => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active) return;

      const nextSections = active.notes.sections.map((s) =>
        s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s
      );

      get().updateNotesDocumentManual(
        {
          ...active.notes,
          sections: nextSections
        },
        `Added ${block.type.replace('_', ' ')} block`
      );
    },

    undoNotes: () => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active || active.versionIndex <= 0) return;

      const prevIndex = active.versionIndex - 1;
      const restoredSnapshot: NotesDocument = JSON.parse(
        JSON.stringify(active.noteVersions[prevIndex].snapshot)
      );

      const updatedSession: StudySession = {
        ...active,
        notes: restoredSnapshot,
        versionIndex: prevIndex,
        updatedAt: new Date().toISOString()
      };
      persistSessionHelper(updatedSession);
    },

    redoNotes: () => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active || active.versionIndex >= active.noteVersions.length - 1) return;

      const nextIndex = active.versionIndex + 1;
      const restoredSnapshot: NotesDocument = JSON.parse(
        JSON.stringify(active.noteVersions[nextIndex].snapshot)
      );

      const updatedSession: StudySession = {
        ...active,
        notes: restoredSnapshot,
        versionIndex: nextIndex,
        updatedAt: new Date().toISOString()
      };
      persistSessionHelper(updatedSession);
    },

    restoreNoteVersion: (index: number) => {
      const { sessions, activeSessionId } = get();
      const active = sessions[activeSessionId];
      if (!active || index < 0 || index >= active.noteVersions.length) return;

      const restoredSnapshot: NotesDocument = JSON.parse(
        JSON.stringify(active.noteVersions[index].snapshot)
      );

      const updatedSession: StudySession = {
        ...active,
        notes: restoredSnapshot,
        versionIndex: index,
        updatedAt: new Date().toISOString()
      };
      persistSessionHelper(updatedSession);
    },

    updatePanelLayout: (partial) => {
      const next = { ...get().panelLayout, ...partial };
      savePanelLayout(next);
      set({ panelLayout: next });
    },

    setFullscreenPanel: (panel) => set({ fullscreenPanel: panel }),
    setMobileActiveTab: (tab) => set({ mobileActiveTab: tab }),
    setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),
    setSessionModalOpen: (open) => set({ isSessionModalOpen: open }),
    setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
    setVersionDrawerOpen: (open) => set({ isVersionDrawerOpen: open }),

    updateUserProfile: (profile) => {
      saveUserProfile(profile);
      set({ userProfile: profile });
    }
  };
});
