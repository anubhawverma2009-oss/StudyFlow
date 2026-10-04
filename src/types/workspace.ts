export type SubjectType = 'theory' | 'mathematics' | 'programming' | 'general';

export type AIMode = 'ask' | 'change_notes';

export type AIResponseType =
  | 'CHAT_RESPONSE'
  | 'NOTE_GENERATION'
  | 'NOTE_MODIFICATION'
  | 'EXPLANATION'
  | 'SUMMARY';

export type QuickActionType =
  | 'explain'
  | 'summarize'
  | 'make_notes'
  | 'important_points'
  | 'exam_questions'
  | 'examples'
  | 'hinglish'
  | 'make_simple';

export interface PDFPageData {
  pageNumber: number;
  text: string;
  headings: string[];
  formulas: string[];
  hasTables: boolean;
  wordCount: number;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  uploadedAt: string;
  isScanned: boolean;
  subjectType: SubjectType;
  pages: PDFPageData[];
  summary?: string;
  keyTopics?: string[];
}

export type NoteBlockType =
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'definition'
  | 'formula'
  | 'example'
  | 'callout'
  | 'table'
  | 'code'
  | 'exam_tip';

export interface NoteTableData {
  headers: string[];
  rows: string[][];
}

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  title?: string;
  content: string;
  items?: string[];
  tableData?: NoteTableData;
  pageRef?: number;
}

export type NoteSectionCategory =
  | 'overview'
  | 'concepts'
  | 'definitions'
  | 'formulas'
  | 'examples'
  | 'important'
  | 'revision'
  | 'exam_qa'
  | 'custom';

export interface NoteSection {
  id: string;
  heading: string;
  category: NoteSectionCategory;
  blocks: NoteBlock[];
  pageRefs?: number[];
}

export interface NotesDocument {
  documentId: string;
  title: string;
  subjectType: SubjectType;
  sections: NoteSection[];
  version: number;
  updatedAt: string;
}

export type NoteOperationType =
  | 'replace_all'
  | 'update_section'
  | 'insert_section'
  | 'append_to_section'
  | 'remove_section';

export interface NoteModificationPayload {
  operation: NoteOperationType;
  targetHeading?: string;
  summaryOfChanges: string;
  reason: string;
  updatedTitle?: string;
  subjectType?: SubjectType;
  sections?: NoteSection[];
  blocksToAppend?: NoteBlock[];
}

export interface NoteVersion {
  version: number;
  timestamp: string;
  label: string;
  source: 'ai' | 'manual' | 'initial';
  snapshot: NotesDocument;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: AIMode;
  responseType?: AIResponseType;
  content: string;
  timestamp: string;
  pageContext?: number;
  selectedTextContext?: string;
  citedPages?: number[];
  noteChangeSummary?: {
    operation: NoteOperationType;
    targetSection: string;
    versionCreated: number;
    reason: string;
  };
  isError?: boolean;
  retryPayload?: {
    prompt: string;
    mode: AIMode;
    quickAction?: QuickActionType;
    pageImageBase64?: string;
  };
}

export interface StudySession {
  id: string;
  document: DocumentMetadata;
  currentPage: number;
  messages: ChatMessage[];
  notes: NotesDocument;
  noteVersions: NoteVersion[];
  versionIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  mode: 'guest' | 'authenticated';
  institution?: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export type ZoomMode = 'custom' | 'fit-width' | 'fit-page';
