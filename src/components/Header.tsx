import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  History,
  Keyboard,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  copyNotesToClipboard,
  exportNotesAsDocx,
  exportNotesAsMarkdown,
  exportNotesAsPdf,
} from '../services/notes/exportService';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export const Header: React.FC = () => {
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [isStudyMenuOpen, setIsStudyMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSecondaryMenuOpen, setIsSecondaryMenuOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // Rename Study modal state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete Study confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const saveStatus = useWorkspaceStore((s) => s.saveStatus);
  const isProcessingPdf = useWorkspaceStore((s) => s.isProcessingPdf);
  const pdfBytes = useWorkspaceStore((s) => s.pdfBytes);
  const uploadPdfFile = useWorkspaceStore((s) => s.uploadPdfFile);
  const startNewStudySession = useWorkspaceStore((s) => s.startNewStudySession);
  const historyList = useWorkspaceStore((s) => s.historyList);
  const isHistorySidebarOpen = useWorkspaceStore((s) => s.isHistorySidebarOpen);
  const setHistorySidebarOpen = useWorkspaceStore((s) => s.setHistorySidebarOpen);
  const renameHistorySession = useWorkspaceStore((s) => s.renameHistorySession);
  const deleteHistorySession = useWorkspaceStore((s) => s.deleteHistorySession);
  const duplicateNotice = useWorkspaceStore((s) => s.duplicateNotice);
  const clearDuplicateNotice = useWorkspaceStore((s) => s.clearDuplicateNotice);

  const setShortcutsModalOpen = useWorkspaceStore((s) => s.setShortcutsModalOpen);
  const setAuthModalOpen = useWorkspaceStore((s) => s.setAuthModalOpen);
  const setSessionModalOpen = useWorkspaceStore((s) => s.setSessionModalOpen);
  const setVersionDrawerOpen = useWorkspaceStore((s) => s.setVersionDrawerOpen);
  const userProfile = useWorkspaceStore((s) => s.userProfile);

  const activeSession = sessions[activeSessionId];
  const studyTitle = activeSession?.document?.title || activeSession?.document?.fileName || 'Untitled Study';

  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadPdfFile(file);
      e.target.value = '';
    }
  };

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadPdfFile(file);
      e.target.value = '';
    }
  };

  const handleDownloadPdf = () => {
    setIsStudyMenuOpen(false);
    if (!pdfBytes) {
      alert('PDF data is not yet loaded in memory. Please select a study session with an active PDF.');
      return;
    }
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeSession?.document?.fileName || `${studyTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenRenameModal = () => {
    setIsStudyMenuOpen(false);
    setRenameInput(studyTitle);
    setIsRenameModalOpen(true);
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameInput.trim() || !activeSessionId) return;
    setIsRenaming(true);
    try {
      await renameHistorySession(activeSessionId, renameInput.trim());
      setIsRenameModalOpen(false);
    } catch (err: any) {
      console.error('Rename failed:', err);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleOpenDeleteModal = () => {
    setIsStudyMenuOpen(false);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!activeSessionId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteHistorySession(activeSessionId);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      console.error('Delete failed:', err);
      setDeleteError(err.message || 'Failed to remove storage and database records. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!activeSession) return;
    const ok = await copyNotesToClipboard(activeSession.notes);
    if (ok) {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
    setIsExportMenuOpen(false);
  };

  return (
    <>
      <header className="h-13 bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-5 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left Section: History toggle, Brand, + New Study */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setHistorySidebarOpen(!isHistorySidebarOpen)}
            className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              isHistorySidebarOpen
                ? 'bg-slate-100 text-slate-800 border-slate-300'
                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
            }`}
            title="Toggle Study History Sidebar"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden md:inline">History</span>
            {historyList.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-slate-200 text-slate-700 rounded-full font-mono">
                {historyList.length}
              </span>
            )}
          </button>

          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              setHistorySidebarOpen(true);
            }}
            className="font-display text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap flex items-center gap-1.5 hover:opacity-85 transition-opacity"
          >
            <span className="bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">
              StudyFlow
            </span>
          </a>

          <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {/* + New Study Button */}
          <button
            type="button"
            onClick={() => startNewStudySession()}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
            title="Start a fresh study session (previous stays in History)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Study</span>
          </button>
        </div>

        {/* Center Section: Focused Active PDF/Study Name with Management Menu & Autosave */}
        <div className="flex items-center gap-2 min-w-0 max-w-sm sm:max-w-md lg:max-w-lg">
          {activeSession ? (
            <div className="relative flex items-center">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-xs text-slate-800 max-w-[200px] sm:max-w-[280px] lg:max-w-[340px]"
                title={studyTitle}
              >
                <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-medium truncate">{studyTitle}</span>

                {/* PDF/Study Management Menu Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsStudyMenuOpen((v) => !v)}
                  className="p-1 -mr-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Study options: Rename, Replace PDF, Download, Delete"
                  aria-label="Manage current study"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Study Management Dropdown Menu */}
              {isStudyMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsStudyMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 z-50 text-xs font-medium text-slate-700 animate-in fade-in duration-75"
                  >
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      Study Management
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenRenameModal}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors text-slate-700"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Rename Study</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsStudyMenuOpen(false);
                        replaceFileInputRef.current?.click();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors text-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Replace PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={!pdfBytes}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors text-slate-700 disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Download PDF</span>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={handleOpenDeleteModal}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors text-rose-600 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Study</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No study session loaded</div>
          )}

          {/* Subtle Autosave Status Indicator */}
          <div className="hidden sm:inline-flex items-center text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap pl-1">
            {isProcessingPdf ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[11px]">Processing PDF</span>
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                <span className="text-[11px]">Saving...</span>
              </span>
            ) : saveStatus === 'error' ? (
              <span className="inline-flex items-center gap-1 text-amber-600" title="Retrying autosave...">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                <span className="text-[11px]">Retrying save</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400 font-normal">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                <span className="text-[11px] text-slate-500">Saved</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Section: Export Primary + Contextual ⋯ Secondary Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Hidden file inputs for upload and replace */}
          <input
            ref={uploadFileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleUploadFileChange}
            className="hidden"
            aria-label="Upload PDF file"
          />
          <input
            ref={replaceFileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleReplaceFileChange}
            className="hidden"
            aria-label="Replace PDF file"
          />

          {/* Primary Export Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={!activeSession}
              className="h-8 px-3 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {copiedToast ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown className="w-3 h-3 opacity-80" />
                </>
              )}
            </button>

            {isExportMenuOpen && activeSession && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 z-50 text-xs font-medium text-slate-700 animate-in fade-in duration-75"
                >
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Export Notes
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      exportNotesAsPdf(activeSession.notes);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">PDF Document</div>
                      <div className="text-[10px] text-slate-500 font-normal">Formatted academic notes</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportNotesAsMarkdown(activeSession.notes);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">Markdown (.md)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Standard GitHub markdown</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportNotesAsDocx(activeSession.notes);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">Microsoft Word (.doc)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Word document</div>
                    </div>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors text-slate-700"
                  >
                    <Copy className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Copy Markdown to Clipboard</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Secondary Actions Contextual ⋯ Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSecondaryMenuOpen((v) => !v)}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              title="More workspace options"
              aria-label="More workspace options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isSecondaryMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSecondaryMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 z-50 text-xs font-medium text-slate-700 animate-in fade-in duration-75"
                >
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Workspace &amp; History
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      uploadFileInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Upload New PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      setSessionModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Load Sample Textbooks</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      setVersionDrawerOpen(true);
                    }}
                    disabled={!activeSession}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors disabled:opacity-40"
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Note Versions</span>
                    </div>
                    {activeSession && (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {activeSession.noteVersions.length}
                      </span>
                    )}
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      setShortcutsModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Keyboard Shortcuts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      setAuthModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">Profile: {userProfile.name}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Duplicate Document Detection Notification */}
      {duplicateNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-900 z-20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{duplicateNotice}</span>
          </div>
          <button
            onClick={() => clearDuplicateNotice()}
            className="p-1 text-emerald-700 hover:text-emerald-900 rounded-md cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Rename Study Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-1">
              Rename Study
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Give this study session a clear, descriptive academic title.
            </p>
            <form onSubmit={handleConfirmRename}>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Study session title"
                autoFocus
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-emerald-600 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming || !renameInput.trim()}
                  className="px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium cursor-pointer disabled:opacity-50"
                >
                  {isRenaming ? 'Saving...' : 'Save Title'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Study Confirmation Modal (CRITICAL SAFETY & VERIFIED CLEANUP) */}
      {isDeleteModalOpen && activeSession && (
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
                  Your PDF, notes, chat history, versions and associated study data for{' '}
                  <strong className="text-slate-800">{studyTitle}</strong> will be
                  permanently removed.
                </p>
                {deleteError && (
                  <p className="text-xs text-rose-600 mt-2 p-2.5 bg-rose-50 rounded-lg border border-rose-200 font-medium">
                    {deleteError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Permanently...</span>
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
