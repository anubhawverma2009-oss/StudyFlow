import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Keyboard,
  Loader2,
  Upload,
  User,
} from 'lucide-react';
import {
  copyNotesToClipboard,
  exportNotesAsDocx,
  exportNotesAsMarkdown,
  exportNotesAsPdf,
} from '../services/notes/exportService';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export const Header: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const saveStatus = useWorkspaceStore((s) => s.saveStatus);
  const isProcessingPdf = useWorkspaceStore((s) => s.isProcessingPdf);
  const uploadPdfFile = useWorkspaceStore((s) => s.uploadPdfFile);
  const setSessionModalOpen = useWorkspaceStore((s) => s.setSessionModalOpen);
  const setShortcutsModalOpen = useWorkspaceStore((s) => s.setShortcutsModalOpen);
  const setAuthModalOpen = useWorkspaceStore((s) => s.setAuthModalOpen);
  const setVersionDrawerOpen = useWorkspaceStore((s) => s.setVersionDrawerOpen);
  const userProfile = useWorkspaceStore((s) => s.userProfile);

  const activeSession = sessions[activeSessionId];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadPdfFile(file);
      e.target.value = '';
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
    <header className="h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between shrink-0 z-30">
      <a
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          setSessionModalOpen(true);
        }}
        className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap"
      >
        StudyFlow
      </a>

      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
        <button
          type="button"
          onClick={() => setSessionModalOpen(true)}
          className="flex items-center gap-2 text-slate-800 hover:text-blue-700 transition-colors whitespace-nowrap max-w-[260px] truncate"
          title="Switch study session or load sample textbook PDF"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">
            {activeSession ? activeSession.document.fileName : 'No PDF Loaded'}
          </span>
        </button>

        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>

        <span className="text-slate-500 whitespace-nowrap tabular-nums">
          {isProcessingPdf ? (
            <span className="inline-flex items-center gap-1.5 text-blue-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processing PDF
            </span>
          ) : saveStatus === 'saving' ? (
            'Saving session...'
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={() => setVersionDrawerOpen(true)}
          className="hover:text-slate-900 transition-colors whitespace-nowrap tabular-nums"
        >
          History ({activeSession ? activeSession.noteVersions.length : 0})
        </button>

        <button
          type="button"
          onClick={() => setShortcutsModalOpen(true)}
          className="hover:text-slate-900 transition-colors whitespace-nowrap inline-flex items-center gap-1"
          title="Keyboard Shortcuts"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Shortcuts</span>
        </button>

        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="hover:text-slate-900 transition-colors whitespace-nowrap inline-flex items-center gap-1"
        >
          <User className="w-3.5 h-3.5" />
          <span>{userProfile.name}</span>
        </button>
      </nav>

      <div className="flex items-center gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload PDF file"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingPdf}
          className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload PDF</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsExportMenuOpen((prev) => !prev)}
            disabled={!activeSession}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {copiedToast ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Notes</span>
              </>
            )}
          </button>

          {isExportMenuOpen && activeSession && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsExportMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-50 text-xs text-slate-700">
                <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400 border-b border-slate-100">
                  Export "{activeSession.notes.title.slice(0, 22)}..."
                </div>
                <button
                  type="button"
                  onClick={() => {
                    exportNotesAsPdf(activeSession.notes);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  <span>Export as PDF (.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportNotesAsMarkdown(activeSession.notes);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export as Markdown (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportNotesAsDocx(activeSession.notes);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Export as Word (.doc)</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>Copy Notes to Clipboard</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
