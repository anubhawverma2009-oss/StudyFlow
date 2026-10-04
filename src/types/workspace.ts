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
  content: string;
  title?: string;
  items?: string[];
  pageRef?: number;
  language?: string;
  tableData?: NoteTableData;
  calloutType?: 'info' | 'warning' | 'tip' | 'formula';
  calloutTitle?: string;
  exampleProblem?: string;
  exampleSolution?: string;
}

export type NoteSectionCategory =
  | 'overview'
  | 'concepts'
  | 'definitions'
  | 'formulas'
  | 'key_takeaways'
  | 'examples'
  | 'important'
  | 'revision'
  | 'exam_qa'
  | 'exam_prep'
  | 'code_reference'
  | 'custom';

export interface NoteSection {
  id: string;
  heading: string;
  category: NoteSectionCategory;
  pageRefs: number[];
  blocks: NoteBlock[];
}

export interface NotesDocument {
  documentId: string;
  title: string;
  subjectType: SubjectType;
  version: number;
  updatedAt: string;
  sections: NoteSection[];
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
  targetSectionHeading?: string;
  summary?: string;
  summaryOfChanges?: string;
  reason?: string;
  sections?: NoteSection[];
  updatedSection?: NoteSection;
  newSection?: NoteSection;
  insertAfterHeading?: string;
  blocksToAppend?: NoteBlock[];
  updatedTitle?: string;
  subjectType?: SubjectType;
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
  mode?: AIMode;
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

export type MobileTab = 'history' | 'pdf' | 'chat' | 'notes';

export interface PanelLayoutConfig {
  pdfWidthPercent: number;
  chatWidthPercent?: number;
  notesWidthPercent: number;
  isPdfCollapsed: boolean;
  isChatCollapsed?: boolean;
  isNotesCollapsed: boolean;
}
