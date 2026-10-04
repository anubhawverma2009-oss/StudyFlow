import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  FileText,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { HistoryItem } from '../services/api/studyApi.ts';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

function formatHistoryDate(dateStr: string): { group: 'TODAY' | 'YESTERDAY' | 'OLDER'; timeFormatted: string } {
  const date = new Date(dateStr);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return { group: 'TODAY', timeFormatted };
  if (isYesterday) return { group: 'YESTERDAY', timeFormatted: 'Yesterday' };
  return { group: 'OLDER', timeFormatted: date.toLocaleDateString([], { month: 'short', day: 'numeric' }) };
}

export const HistorySidebar: React.FC = () => {
  const isHistorySidebarOpen = useWorkspaceStore((s) => s.isHistorySidebarOpen);
  const setHistorySidebarOpen = useWorkspaceStore((s) => s.setHistorySidebarOpen);
  const historyList = useWorkspaceStore((s) => s.historyList);
  const isHistoryLoading = useWorkspaceStore((s) => s.isHistoryLoading);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const startNewStudySession = useWorkspaceStore((s) => s.startNewStudySession);
  const openHistorySession = useWorkspaceStore((s) => s.openHistorySession);
  const renameHistorySession = useWorkspaceStore((s) => s.renameHistorySession);
  const deleteHistorySession = useWorkspaceStore((s) => s.deleteHistorySession);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);

  // Rename state
  const [renamingSession, setRenamingSession] = useState<{ id: string; title: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Delete confirmation modal state
  const [deletingSession, setDeletingSession] = useState<HistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter history by search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return historyList;
    const q = searchQuery.toLowerCase();
    return historyList.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.fileName.toLowerCase().includes(q)
    );
  }, [historyList, searchQuery]);

  // Group by Today, Yesterday, Older
  const groupedHistory = useMemo(() => {
    const groups: {
      TODAY: Array<HistoryItem & { timeFormatted: string }>;
      YESTERDAY: Array<HistoryItem & { timeFormatted: string }>;
      OLDER: Array<HistoryItem & { timeFormatted: string }>;
    } = {
      TODAY: [],
      YESTERDAY: [],
      OLDER: [],
    };

    filteredList.forEach((item) => {
      const { group, timeFormatted } = formatHistoryDate(item.lastStudiedAt || item.createdAt);
      groups[group].push({ ...item, timeFormatted });
    });

    return groups;
  }, [filteredList]);

  const handleStartRename = (item: HistoryItem) => {
    setRenamingSession({ id: item.id, title: item.title });
    setRenameInput(item.title);
    setActiveMenuSessionId(null);
  };

  const handleConfirmRename = async () => {
    if (!renamingSession || !renameInput.trim()) return;
    await renameHistorySession(renamingSession.id, renameInput.trim());
    setRenamingSession(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSession) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteHistorySession(deletingSession.id);
      setDeletingSession(null);
    } catch (err: any) {
      setDeleteError(err.message || "Couldn't completely delete this study session. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isHistorySidebarOpen) {
    return (
      <aside aria-label="Study History sidebar" className="hidden lg:flex flex-col items-center py-3 px-1 border-r border-slate-200 bg-white shrink-0 z-20">
        <button
          onClick={() => setHistorySidebarOpen(true)}
          title="Open Study History"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => startNewStudySession()}
          title="+ New Study"
          className="mt-3 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="mt-6 [writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Study History
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside aria-label="Study History sidebar" className="w-72 md:w-80 h-full border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 z-20 transition-all select-none">
        {/* Top Header */}
        <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h2 className="font-display text-sm font-semibold text-slate-900 tracking-tight">
              Study History
            </h2>
          </div>
          <button
            onClick={() => setHistorySidebarOpen(false)}
            title="Collapse History Sidebar"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Primary "+ New Study" button */}
        <div className="p-3 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => startNewStudySession()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Study</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-200 bg-white shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-md outline-hidden text-slate-800 placeholder-slate-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* History List Groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {isHistoryLoading && (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-xs">Loading study history...</span>
            </div>
          )}

          {!isHistoryLoading && filteredList.length === 0 && (
            <div className="py-12 text-center text-slate-400 px-4">
              <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-1" />
              <p className="text-xs font-medium text-slate-600">
                {searchQuery ? 'No documents match your search' : 'No study sessions yet'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {searchQuery
                  ? 'Try searching by a different name or keyword.'
                  : 'Upload a PDF or start a new study session to begin.'}
              </p>
            </div>
          )}

          {(['TODAY', 'YESTERDAY', 'OLDER'] as const).map((groupKey) => {
            const items = groupedHistory[groupKey];
            if (items.length === 0) return null;

            return (
              <div key={groupKey} className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
                  {groupKey}
                </div>

                {items.map((item) => {
                  const isActive = item.id === activeSessionId;
                  const isMenuOpen = activeMenuSessionId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`group relative rounded-lg border text-xs transition-all ${
                        isActive
                          ? 'bg-emerald-50/80 border-emerald-300 shadow-xs text-slate-900'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs text-slate-700'
                      }`}
                    >
                      <div
                        onClick={() => openHistorySession(item.id)}
                        className="p-2.5 pr-8 cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0">
                            <FileText
                              className={`w-3.5 h-3.5 ${
                                isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-slate-900 leading-snug">
                              {item.title || item.fileName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                              <span>{item.pageCount} pages</span>
                              <span>•</span>
                              <span>{item.timeFormatted}</span>
                              {item.currentPage > 1 && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-medium">p.{item.currentPage}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Menu Trigger (⋮) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSessionId(isMenuOpen ? null : item.id);
                        }}
                        className={`absolute right-1.5 top-2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${
                          isMenuOpen ? 'bg-slate-100 text-slate-700' : 'opacity-70 group-hover:opacity-100'
                        }`}
                        title="Session options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Popup Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-8 z-30 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs"
                        >
                          <button
                            onClick={() => {
                              openHistorySession(item.id);
                              setActiveMenuSessionId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                            <span>Open</span>
                          </button>
                          <button
                            onClick={() => handleStartRename(item)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Rename</span>
                          </button>
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            onClick={() => {
                              setActiveMenuSessionId(null);
                              setDeletingSession(item);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Rename Modal */}
      {renamingSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-2">
              Rename Study Session
            </h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
              placeholder="Session title"
              autoFocus
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenamingSession(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRename}
                className="px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-medium"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (CRITICAL SAFETY) */}
      {deletingSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-full shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Delete this study session?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your PDF, notes, chat history and associated study data for{' '}
                  <strong className="text-slate-800">{deletingSession.title}</strong> will be
                  permanently removed.
                </p>
                {deleteError && (
                  <p className="text-xs text-rose-600 mt-2 p-2 bg-rose-50 rounded-md border border-rose-200">
                    {deleteError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                disabled={isDeleting}
                onClick={() => {
                  setDeletingSession(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting from Storage...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
