import { auth } from '../../lib/firebase.ts';

function getLocalUserId(): string {
  let uid = localStorage.getItem('studyflow_user_id');
  if (!uid) {
    uid = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('studyflow_user_id', uid);
  }
  return uid;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': getLocalUserId(),
  };

  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-user-email'] = currentUser.email || '';
      headers['x-user-name'] = currentUser.displayName || '';
    }
  } catch {
    // Continue with local user id
  }

  return headers;
}

export interface HistoryItem {
  id: string;
  title: string;
  documentId: string | null;
  fileName: string;
  fileSize: number;
  pageCount: number;
  currentPage: number;
  isScanned: boolean;
  lastStudiedAt: string;
  createdAt: string;
  notesCount: number;
  messageCount: number;
}

export const StudyApi = {
  async getHistory(): Promise<HistoryItem[]> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/history', { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch history: ${res.statusText}`);
    }
    const data = await res.json();
    return data.history || [];
  },

  async checkDuplicate(fileHash: string): Promise<{
    exists: boolean;
    documentId?: string;
    latestSessionId?: string;
    title?: string;
  }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/documents/check-duplicate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileHash }),
    });
    if (!res.ok) return { exists: false };
    return res.json();
  },

  async uploadSession(payload: {
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
  }): Promise<{ sessionId: string; documentId: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/sessions/upload', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to auto-create study session');
    }
    return res.json();
  },

  async getSession(sessionId: string): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sessions/${sessionId}`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to load session: ${res.statusText}`);
    }
    return res.json();
  },

  async autosave(sessionId: string, data: any): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sessions/${sessionId}/autosave`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Autosave request failed');
    }
  },

  async renameSession(sessionId: string, title: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      throw new Error('Failed to rename study session');
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Couldn't completely delete this study session. Please try again.");
    }
  },
};
