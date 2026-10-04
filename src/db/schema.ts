import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Users table (profiles) keyed by Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  institution: text('institution'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Documents table for uploaded PDFs
export const documents = pgTable('documents', {
  id: text('id').primaryKey(), // doc UUID
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  fileType: text('file_type').default('application/pdf').notNull(),
  fileHash: text('file_hash'), // SHA-256 for duplicate detection
  storagePath: text('storage_path'), // storage path or identifier
  pageCount: integer('page_count').default(1).notNull(),
  extractedSummary: text('extracted_summary'),
  isScanned: boolean('is_scanned').default(false).notNull(),
  pdfBase64: text('pdf_base64'), // full base64 data for seamless persistence
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Study Sessions table
export const studySessions = pgTable('study_sessions', {
  id: text('id').primaryKey(), // session UUID
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  documentId: text('document_id').references(() => documents.id, {
    onDelete: 'cascade',
  }),
  title: text('title').notNull(),
  currentPage: integer('current_page').default(1).notNull(),
  lastStudiedAt: timestamp('last_studied_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Document Chunks table for retrieval
export const documentChunks = pgTable('document_chunks', {
  id: serial('id').primaryKey(),
  documentId: text('document_id')
    .references(() => documents.id, { onDelete: 'cascade' })
    .notNull(),
  pageNumber: integer('page_number').notNull(),
  chunkText: text('chunk_text').notNull(),
  headings: text('headings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Chat Messages table
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .references(() => studySessions.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Notes table
export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .references(() => studySessions.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  subject: text('subject').default('general').notNull(),
  content: jsonb('content').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Note Versions table
export const noteVersions = pgTable('note_versions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .references(() => studySessions.id, { onDelete: 'cascade' })
    .notNull(),
  versionNumber: integer('version_number').notNull(),
  label: text('label').notNull(),
  source: text('source').default('ai').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  studySessions: many(studySessions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.uid],
  }),
  studySessions: many(studySessions),
  chunks: many(documentChunks),
}));

export const studySessionsRelations = relations(studySessions, ({ one, many }) => ({
  user: one(users, {
    fields: [studySessions.userId],
    references: [users.uid],
  }),
  document: one(documents, {
    fields: [studySessions.documentId],
    references: [documents.id],
  }),
  messages: many(chatMessages),
  notes: many(notes),
  noteVersions: many(noteVersions),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(studySessions, {
    fields: [chatMessages.sessionId],
    references: [studySessions.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  session: one(studySessions, {
    fields: [notes.sessionId],
    references: [studySessions.id],
  }),
}));

export const noteVersionsRelations = relations(noteVersions, ({ one }) => ({
  session: one(studySessions, {
    fields: [noteVersions.sessionId],
    references: [studySessions.id],
  }),
}));
