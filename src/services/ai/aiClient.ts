import {
  AIResponseType,
  ChatMessage,
  DocumentMetadata,
  NoteModificationPayload,
  NotesDocument,
  QuickActionType,
} from '../../types/workspace';
import { retrieveRelevantDocumentContext } from '../pdf/pdfProcessor';

export interface ChatResponsePayload {
  reply: string;
  responseType: AIResponseType;
  citedPages: number[];
}

export interface ModifyNotesResponsePayload {
  reply: string;
  responseType: 'NOTE_GENERATION' | 'NOTE_MODIFICATION';
  citedPages: number[];
  modification: NoteModificationPayload;
}

class ClientAIService {
  async analyzeDocument(
    document: DocumentMetadata,
    signal?: AbortSignal
  ): Promise<{ summary: string; keyTopics: string[] }> {
    const context = retrieveRelevantDocumentContext(
      document,
      1,
      'Provide a concise chapter overview and key topics',
      undefined,
      Math.min(5, document.pageCount)
    );

    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        documentTitle: document.title,
        subjectType: document.subjectType,
        pageCount: document.pageCount,
        documentContext: context.contextText
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to analyze document.');
    }

    return response.json();
  }

  async chat(params: {
    document: DocumentMetadata;
    currentPage: number;
    selectedText?: string;
    userMessage: string;
    recentMessages: ChatMessage[];
    quickAction?: QuickActionType;
    pageImageBase64?: string;
    signal?: AbortSignal;
  }): Promise<ChatResponsePayload> {
    const {
      document,
      currentPage,
      selectedText,
      userMessage,
      recentMessages,
      quickAction,
      pageImageBase64,
      signal
    } = params;

    const { contextText, includedPages } = retrieveRelevantDocumentContext(
      document,
      currentPage,
      userMessage,
      selectedText,
      4
    );

    const compactHistory = recentMessages
      .filter((m) => !m.isError)
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 900)
      }));

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        documentContext: contextText,
        includedPages,
        currentPage,
        selectedText,
        userMessage,
        quickAction,
        recentHistory: compactHistory,
        pageImageBase64
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error || 'AI Tutor is temporarily unavailable. Please try again.'
      );
    }

    return response.json();
  }

  async explain(params: {
    document: DocumentMetadata;
    currentPage: number;
    selectedText?: string;
    instruction?: string;
    recentMessages: ChatMessage[];
    signal?: AbortSignal;
  }): Promise<ChatResponsePayload> {
    const prompt =
      params.instruction ||
      (params.selectedText
        ? `Explain this selected passage from Page ${params.currentPage} clearly with an example:\n"${params.selectedText}"`
        : `Explain the core concepts on Page ${params.currentPage} in simple terms with an example.`);

    return this.chat({
      document: params.document,
      currentPage: params.currentPage,
      selectedText: params.selectedText,
      userMessage: prompt,
      recentMessages: params.recentMessages,
      quickAction: 'explain',
      signal: params.signal
    });
  }

  async generateNotes(params: {
    document: DocumentMetadata;
    currentPage: number;
    selectedText?: string;
    customInstruction?: string;
    signal?: AbortSignal;
  }): Promise<ModifyNotesResponsePayload> {
    const { document, currentPage, selectedText, customInstruction, signal } = params;
    const query =
      customInstruction ||
      'Generate comprehensive, exam-oriented structured study notes for this document.';

    const { contextText, includedPages } = retrieveRelevantDocumentContext(
      document,
      currentPage,
      query,
      selectedText,
      Math.min(6, document.pageCount)
    );

    const response = await fetch('/api/ai/generate-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        documentTitle: document.title,
        subjectType: document.subjectType,
        currentPage,
        selectedText,
        instruction: query,
        documentContext: contextText,
        includedPages
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error || 'Could not generate notes right now. Please retry.'
      );
    }

    return response.json();
  }

  async modifyNotes(params: {
    document: DocumentMetadata;
    currentPage: number;
    selectedText?: string;
    currentNotes: NotesDocument;
    instruction: string;
    targetSectionHeading?: string;
    signal?: AbortSignal;
  }): Promise<ModifyNotesResponsePayload> {
    const {
      document,
      currentPage,
      selectedText,
      currentNotes,
      instruction,
      targetSectionHeading,
      signal
    } = params;

    const { contextText, includedPages } = retrieveRelevantDocumentContext(
      document,
      currentPage,
      instruction,
      selectedText,
      4
    );

    const response = await fetch('/api/ai/modify-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        documentTitle: document.title,
        subjectType: document.subjectType,
        currentPage,
        selectedText,
        instruction,
        targetSectionHeading,
        documentContext: contextText,
        includedPages,
        currentNotes
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error || 'Failed to modify notes. Your existing notes were preserved.'
      );
    }

    return response.json();
  }
}

export const AIService = new ClientAIService();
