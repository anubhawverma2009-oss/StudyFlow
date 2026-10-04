import { StudySession, UserProfile } from '../../types/workspace';

const SESSIONS_STORAGE_KEY = 'scholarsync_study_sessions_v1';
const ACTIVE_SESSION_ID_KEY = 'scholarsync_active_session_id_v1';
const USER_PROFILE_KEY = 'scholarsync_user_profile_v1';
const PANEL_LAYOUT_KEY = 'scholarsync_panel_layout_v1';

const IDB_NAME = 'ScholarSyncPdfBinaryDB';
const IDB_STORE = 'pdf_binaries';

function openPdfIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePdfBytesToIdb(docId: string, bytes: Uint8Array): Promise<void> {
  try {
    const db = await openPdfIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, docId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function loadPdfBytesFromIdb(docId: string): Promise<Uint8Array | null> {
  try {
    const db = await openPdfIdb();
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(docId);
      req.onsuccess = () => {
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else if (req.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(tx.error);
    });
  } catch {
    return null;
  }
}

export function loadAllSessionsLocal(): Record<string, StudySession> {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSessionLocal(session: StudySession): void {
  try {
    const all = loadAllSessionsLocal();
    all[session.id] = session;
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(all));
    localStorage.setItem(ACTIVE_SESSION_ID_KEY, session.id);
  } catch {
    // Ignore
  }
}

export function deleteSessionLocal(sessionId: string): void {
  try {
    const all = loadAllSessionsLocal();
    delete all[sessionId];
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore
  }
}

export function getActiveSessionIdLocal(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveSessionIdLocal(sessionId: string): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_ID_KEY, sessionId);
  } catch {
    // Ignore
  }
}

export async function syncSessionToServer(session: StudySession, userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/sessions/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scholarsync-user': userId
      },
      body: JSON.stringify({ session })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  return {
    id: 'guest_scholar',
    name: 'Guest Scholar',
    email: 'guest@scholarsync.edu',
    mode: 'guest',
    institution: 'Local Study Session'
  };
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore
  }
}

export interface PanelLayoutConfig {
  pdfWidthPercent: number;
  chatWidthPercent?: number;
  notesWidthPercent: number;
  isPdfCollapsed: boolean;
  isChatCollapsed?: boolean;
  isNotesCollapsed: boolean;
}

export function loadPanelLayout(): PanelLayoutConfig {
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  return {
    pdfWidthPercent: 34,
    chatWidthPercent: 31,
    notesWidthPercent: 35,
    isPdfCollapsed: false,
    isChatCollapsed: false,
    isNotesCollapsed: false
  };
}

export function savePanelLayout(layout: PanelLayoutConfig): void {
  try {
    localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Ignore
  }
}

export const getPanelLayoutLocal = loadPanelLayout;
export const getUserProfileLocal = loadUserProfile;
export const saveActiveSessionIdLocal = setActiveSessionIdLocal;
export const savePanelLayoutLocal = savePanelLayout;
export const saveUserProfileLocal = saveUserProfile;
