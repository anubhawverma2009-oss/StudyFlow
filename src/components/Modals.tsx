import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  FilePlus2,
  FolderOpen,
  History,
  Keyboard,
  RotateCcw,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { SampleDocKey, SAMPLE_TEMPLATES } from '../utils/sampleDocuments';

export const WorkspaceModals: React.FC = () => {
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const isShortcutsModalOpen = useWorkspaceStore((s) => s.isShortcutsModalOpen);
  const setShortcutsModalOpen = useWorkspaceStore((s) => s.setShortcutsModalOpen);
  const isSessionModalOpen = useWorkspaceStore((s) => s.isSessionModalOpen);
  const setSessionModalOpen = useWorkspaceStore((s) => s.setSessionModalOpen);
  const isVersionDrawerOpen = useWorkspaceStore((s) => s.isVersionDrawerOpen);
  const setVersionDrawerOpen = useWorkspaceStore((s) => s.setVersionDrawerOpen);
  const isAuthModalOpen = useWorkspaceStore((s) => s.isAuthModalOpen);
  const setAuthModalOpen = useWorkspaceStore((s) => s.setAuthModalOpen);

  const switchSession = useWorkspaceStore((s) => s.switchSession);
  const deleteSession = useWorkspaceStore((s) => s.deleteSession);
  const loadSampleDocument = useWorkspaceStore((s) => s.loadSampleDocument);
  const clearWorkspaceForEmptyState = useWorkspaceStore((s) => s.clearWorkspaceForEmptyState);
  const restoreNoteVersion = useWorkspaceStore((s) => s.restoreNoteVersion);
  const userProfile = useWorkspaceStore((s) => s.userProfile);
  const updateUserProfile = useWorkspaceStore((s) => s.updateUserProfile);

  const activeSession = sessions[activeSessionId];

  const [nameInput, setNameInput] = useState(userProfile.name);
  const [emailInput, setEmailInput] = useState(userProfile.email);
  const [instInput, setInstInput] = useState(userProfile.institution || '');

  return (
    <>
      {isShortcutsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-blue-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              {[
                { keys: 'Ctrl / Cmd + S', desc: 'Save current study session & notes' },
                { keys: 'Ctrl / Cmd + Z', desc: 'Undo last AI or manual note change' },
                { keys: 'Ctrl / Cmd + Shift + Z', desc: 'Redo note change' },
                { keys: 'Enter', desc: 'Send message to AI Study Assistant' },
                { keys: 'Shift + Enter', desc: 'Insert newline in AI chat input' },
                { keys: 'Escape', desc: 'Close active modal or drawer' }
              ].map((item) => (
                <div
                  key={item.keys}
                  className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-none"
                >
                  <span className="text-slate-600">{item.desc}</span>
                  <kbd className="font-mono text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-800">
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isVersionDrawerOpen && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-end">
          <div className="bg-white border-l border-slate-200 h-full max-w-md w-full p-5 flex flex-col shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Notes Version History
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setVersionDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Every AI modification and manual edit creates a protected snapshot. Restore any previous version below.
            </p>

            <div className="mt-4 flex-1 overflow-y-auto space-y-2.5">
              {activeSession.noteVersions
                .slice()
                .reverse()
                .map((ver, revIdx) => {
                  const actualIndex = activeSession.noteVersions.length - 1 - revIdx;
                  const isCurrent = actualIndex === activeSession.versionIndex;
                  return (
                    <div
                      key={`${ver.version}_${ver.timestamp}`}
                      className={`p-3 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'bg-blue-50/60 border-blue-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">{ver.label}</span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {new Date(ver.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Source: {ver.source === 'ai' ? 'AI Modification' : 'Manual / Initial'} ·{' '}
                          {ver.snapshot.sections.length} sections
                        </span>

                        {isCurrent ? (
                          <span className="text-blue-700 font-medium inline-flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              restoreNoteVersion(actualIndex);
                              setVersionDrawerOpen(false);
                            }}
                            className="text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Study Sessions &amp; Sample Textbooks
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSessionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-5 pr-1">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Your Saved Study Sessions ({Object.keys(sessions).length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      clearWorkspaceForEmptyState();
                      setSessionModalOpen(false);
                    }}
                    className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>New Blank Workspace</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {Object.values(sessions).map((sess) => {
                    const isActive = sess.id === activeSessionId;
                    return (
                      <div
                        key={sess.id}
                        className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-blue-50/60 border-blue-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            switchSession(sess.id);
                            setSessionModalOpen(false);
                          }}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {sess.document.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                            Page {sess.currentPage}/{sess.document.pageCount} ·{' '}
                            {sess.messages.length} msgs · {sess.notes.sections.length} note sections
                          </div>
                        </button>

                        {Object.keys(sessions).length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteSession(sess.id)}
                            title="Delete Session"
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                  <span>Load Built-In Academic PDF Textbook</span>
                </h3>
                <div className="space-y-2">
                  {(Object.keys(SAMPLE_TEMPLATES) as SampleDocKey[]).map((key) => {
                    const tmpl = SAMPLE_TEMPLATES[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={async () => {
                          setSessionModalOpen(false);
                          await loadSampleDocument(key);
                        }}
                        className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900">{tmpl.title}</span>
                          <span className="text-[11px] font-mono text-blue-700">
                            {tmpl.pages.length} Pages · {tmpl.subjectType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{tmpl.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Scholar Profile &amp; Session Sync
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUserProfile({
                  id: emailInput.trim()
                    ? `scholar_${emailInput.trim().replace(/[^a-zA-Z0-9]/g, '_')}`
                    : 'guest_scholar',
                  name: nameInput.trim() || 'Guest Scholar',
                  email: emailInput.trim() || 'guest@scholarsync.edu',
                  mode: emailInput.trim() ? 'authenticated' : 'guest',
                  institution: instInput.trim() || 'University Workspace'
                });
                setAuthModalOpen(false);
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Academic Email</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Institution / Course
                </label>
                <input
                  type="text"
                  value={instInput}
                  onChange={(e) => setInstInput(e.target.value)}
                  placeholder="e.g., B.Tech Computer Science — Semester 4"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
