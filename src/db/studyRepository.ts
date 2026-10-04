import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  chatMessages,
  documentChunks,
  documents,
  notes,
  noteVersions,
  studySessions,
  users,
} from './schema.ts';
import { getOrCreateUser } from './users.ts';

export interface CreateSessionParams {
  userId: string;
  userEmail: string;
  userName?: string;
  document: {
    id: string;
    title: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileHash?: string;
    pageCount: number;
    extractedSummary?: string;
    isScanned?: boolean;
    pdfBase64?: string;
    chunks?: Array<{ pageNumber: number; chunkText: string; headings?: string }>;
  };
  initialNotes?: {
    id: string;
    title: string;
    subject: string;
    content: any;
  };
}

export interface HistoryItemDto {
  id: string;
  title: string;
  documentId: string | null;
  fileName: string;
  fileSize: number;
  pageCount: number;
  currentPage: number;
  isScanned: boolean;
  lastStudiedAt: Date;
  createdAt: Date;
  notesCount: number;
  messageCount: number;
}

// 1. Get History for a user
export async function getUserStudyHistory(userId: string): Promise<HistoryItemDto[]> {
  try {
    const rows = await db
      .select({
        id: studySessions.id,
        title: studySessions.title,
        documentId: studySessions.documentId,
        currentPage: studySessions.currentPage,
        lastStudiedAt: studySessions.lastStudiedAt,
        createdAt: studySessions.createdAt,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        pageCount: documents.pageCount,
        isScanned: documents.isScanned,
      })
      .from(studySessions)
      .leftJoin(documents, eq(studySessions.documentId, documents.id))
      .where(eq(studySessions.userId, userId))
      .orderBy(desc(studySessions.lastStudiedAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      documentId: r.documentId,
      fileName: r.fileName || 'Untitled Document',
      fileSize: r.fileSize || 0,
      pageCount: r.pageCount || 1,
      currentPage: r.currentPage || 1,
      isScanned: !!r.isScanned,
      lastStudiedAt: r.lastStudiedAt,
      createdAt: r.createdAt,
      notesCount: 0,
      messageCount: 0,
    }));
  } catch (error) {
    console.error('Failed to get user study history:', error);
    throw new Error('Database error getting study history', { cause: error });
  }
}

// 2. Duplicate Detection: Check if document with hash exists for user
export async function findExistingDocumentByHash(
  userId: string,
  fileHash: string
) {
  try {
    if (!fileHash) return null;
    const existing = await db
      .select()
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.fileHash, fileHash)))
      .limit(1);

    if (existing.length > 0) {
      // Also find the latest session using this document
      const session = await db
        .select()
        .from(studySessions)
        .where(
          and(
            eq(studySessions.userId, userId),
            eq(studySessions.documentId, existing[0].id)
          )
        )
        .orderBy(desc(studySessions.lastStudiedAt))
        .limit(1);

      return {
        document: existing[0],
        latestSessionId: session[0]?.id || null,
      };
    }
    return null;
  } catch (error) {
    console.error('Error checking duplicate document hash:', error);
    return null;
  }
}

// 3. Create or Register a study session with PDF
export async function createStudySessionWithDocument(params: CreateSessionParams) {
  try {
    // Ensure user profile exists
    await getOrCreateUser(params.userId, params.userEmail, params.userName);

    let docId = params.document.id;

    // Check duplicate file hash
    if (params.document.fileHash) {
      const existing = await findExistingDocumentByHash(
        params.userId,
        params.document.fileHash
      );
      if (existing) {
        docId = existing.document.id;
      }
    }

    // Insert document if not reusing
    const docCheck = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1);

    if (docCheck.length === 0) {
      await db.insert(documents).values({
        id: docId,
        userId: params.userId,
        title: params.document.title,
        fileName: params.document.fileName,
        fileSize: params.document.fileSize,
        fileType: params.document.fileType || 'application/pdf',
        fileHash: params.document.fileHash || null,
        storagePath: `user_${params.userId}/${docId}/doc.pdf`,
        pageCount: params.document.pageCount,
        extractedSummary: params.document.extractedSummary || null,
        isScanned: !!params.document.isScanned,
        pdfBase64: params.document.pdfBase64 || null,
      });

      // Insert document chunks if provided
      if (params.document.chunks && params.document.chunks.length > 0) {
        const chunkValues = params.document.chunks.map((c) => ({
          documentId: docId,
          pageNumber: c.pageNumber,
          chunkText: c.chunkText,
          headings: c.headings || null,
        }));
        await db.insert(documentChunks).values(chunkValues);
      }
    }

    // Create the study session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(studySessions).values({
      id: sessionId,
      userId: params.userId,
      documentId: docId,
      title: params.document.title,
      currentPage: 1,
      lastStudiedAt: new Date(),
    });

    // Create initial notes record
    if (params.initialNotes) {
      await db.insert(notes).values({
        id: params.initialNotes.id || `note_${Date.now()}`,
        sessionId: sessionId,
        title: params.initialNotes.title,
        subject: params.initialNotes.subject || 'general',
        content: params.initialNotes.content,
        updatedAt: new Date(),
      });
    }

    return {
      sessionId,
      documentId: docId,
    };
  } catch (error) {
    console.error('Failed to create study session with document:', error);
    throw new Error('Database error creating study session', { cause: error });
  }
}

// 4. Fetch Complete Study Session
export async function getFullStudySession(userId: string, sessionId: string) {
  try {
    const sessionRes = await db
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .limit(1);

    if (sessionRes.length === 0) {
      return null;
    }

    const session = sessionRes[0];

    // Fetch Document
    let docRecord = null;
    let chunks: any[] = [];
    if (session.documentId) {
      const docRes = await db
        .select()
        .from(documents)
        .where(eq(documents.id, session.documentId))
        .limit(1);
      if (docRes.length > 0) {
        docRecord = docRes[0];
        chunks = await db
          .select()
          .from(documentChunks)
          .where(eq(documentChunks.documentId, session.documentId))
          .orderBy(documentChunks.pageNumber);
      }
    }

    // Fetch Chat Messages
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    // Fetch Notes
    const notesRes = await db
      .select()
      .from(notes)
      .where(eq(notes.sessionId, sessionId))
      .limit(1);

    // Fetch Note Versions
    const versions = await db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.sessionId, sessionId))
      .orderBy(noteVersions.versionNumber);

    // Update lastStudiedAt timestamp
    await db
      .update(studySessions)
      .set({ lastStudiedAt: new Date() })
      .where(eq(studySessions.id, sessionId));

    return {
      session,
      document: docRecord,
      chunks,
      messages,
      notes: notesRes[0] || null,
      versions,
    };
  } catch (error) {
    console.error('Failed to fetch full study session:', error);
    throw new Error('Database error fetching full study session', { cause: error });
  }
}

// 5. Autosave Session State
export async function autosaveSessionState(
  userId: string,
  sessionId: string,
  data: {
    currentPage?: number;
    title?: string;
    notes?: {
      title: string;
      subject: string;
      content: any;
    };
    newMessages?: Array<{
      id: string;
      role: string;
      content: string;
      metadata?: any;
    }>;
    newVersion?: {
      id: string;
      versionNumber: number;
      label: string;
      source: string;
      snapshot: any;
    };
  }
) {
  try {
    // Verify session belongs to user
    const sessionRes = await db
      .select({ id: studySessions.id })
      .from(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .limit(1);

    if (sessionRes.length === 0) {
      throw new Error('Study session not found or unauthorized');
    }

    // 1. Update session metadata & current page
    const updateData: any = {
      lastStudiedAt: new Date(),
      updatedAt: new Date(),
    };
    if (data.currentPage !== undefined) {
      updateData.currentPage = data.currentPage;
    }
    if (data.title) {
      updateData.title = data.title;
    }
    await db
      .update(studySessions)
      .set(updateData)
      .where(eq(studySessions.id, sessionId));

    // 2. Upsert Notes
    if (data.notes) {
      const existingNote = await db
        .select({ id: notes.id })
        .from(notes)
        .where(eq(notes.sessionId, sessionId))
        .limit(1);

      if (existingNote.length > 0) {
        await db
          .update(notes)
          .set({
            title: data.notes.title,
            subject: data.notes.subject,
            content: data.notes.content,
            updatedAt: new Date(),
          })
          .where(eq(notes.id, existingNote[0].id));
      } else {
        await db.insert(notes).values({
          id: `note_${Date.now()}`,
          sessionId: sessionId,
          title: data.notes.title,
          subject: data.notes.subject,
          content: data.notes.content,
          updatedAt: new Date(),
        });
      }
    }

    // 3. Insert new chat messages
    if (data.newMessages && data.newMessages.length > 0) {
      for (const msg of data.newMessages) {
        await db
          .insert(chatMessages)
          .values({
            id: msg.id,
            sessionId: sessionId,
            role: msg.role,
            content: msg.content,
            metadata: msg.metadata || null,
          })
          .onConflictDoNothing();
      }
    }

    // 4. Insert new note version if provided
    if (data.newVersion) {
      await db
        .insert(noteVersions)
        .values({
          id: data.newVersion.id,
          sessionId: sessionId,
          versionNumber: data.newVersion.versionNumber,
          label: data.newVersion.label,
          source: data.newVersion.source || 'ai',
          snapshot: data.newVersion.snapshot,
        })
        .onConflictDoNothing();
    }

    return { success: true, savedAt: new Date() };
  } catch (error) {
    console.error('Failed to autosave session state:', error);
    throw new Error('Database error during autosave', { cause: error });
  }
}

// 6. Rename Study Session
export async function renameStudySession(
  userId: string,
  sessionId: string,
  newTitle: string
) {
  try {
    await db
      .update(studySessions)
      .set({ title: newTitle, updatedAt: new Date() })
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));
    return { success: true };
  } catch (error) {
    console.error('Failed to rename study session:', error);
    throw new Error('Database error renaming study session', { cause: error });
  }
}

// 7. Delete Study Session with Complete Resource Cleanup
export async function deleteStudySessionClean(userId: string, sessionId: string) {
  try {
    // 1. Find session and documentId
    const sessionRes = await db
      .select({ id: studySessions.id, documentId: studySessions.documentId })
      .from(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .limit(1);

    if (sessionRes.length === 0) {
      return { success: false, message: 'Session not found' };
    }

    const docId = sessionRes[0].documentId;

    // 2. Delete study session (cascade automatically deletes notes, note_versions, chat_messages)
    await db
      .delete(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));

    // 3. Check if document is still used by other sessions
    if (docId) {
      const otherSessions = await db
        .select({ id: studySessions.id })
        .from(studySessions)
        .where(eq(studySessions.documentId, docId))
        .limit(1);

      // If no other session uses this document, delete the document and its chunks
      if (otherSessions.length === 0) {
        await db.delete(documents).where(eq(documents.id, docId));
        console.log(`Cleaned up orphaned document ${docId} and its storage data.`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete study session:', error);
    throw new Error('Database error deleting study session', { cause: error });
  }
}
