import React, { useEffect, useRef } from 'react';
import {
  BookOpen,
  Clock,
  FileText,
  MessageSquare,
  Minimize2,
  PanelLeftOpen,
  PanelRightOpen,
} from 'lucide-react';
import { Header } from './components/Header';
import { HistorySidebar } from './components/HistorySidebar';
import { WorkspaceModals } from './components/Modals';
import { ChatPanel } from './features/chat/ChatPanel';
import { NotesPanel } from './features/notes/NotesPanel';
import { PDFPanel } from './features/pdf/PDFPanel';
import { useWorkspaceStore } from './stores/useWorkspaceStore';

export default function App() {
  const initializeWorkspace = useWorkspaceStore((s) => s.initializeWorkspace);
  const panelLayout = useWorkspaceStore((s) => s.panelLayout);
  const updatePanelLayout = useWorkspaceStore((s) => s.updatePanelLayout);
  const fullscreenPanel = useWorkspaceStore((s) => s.fullscreenPanel);
  const setFullscreenPanel = useWorkspaceStore((s) => s.setFullscreenPanel);
  const mobileActiveTab = useWorkspaceStore((s) => s.mobileActiveTab);
  const setMobileActiveTab = useWorkspaceStore((s) => s.setMobileActiveTab);
  const saveCurrentSessionNow = useWorkspaceStore((s) => s.saveCurrentSessionNow);
  const undoNotes = useWorkspaceStore((s) => s.undoNotes);
  const redoNotes = useWorkspaceStore((s) => s.redoNotes);
  const setShortcutsModalOpen = useWorkspaceStore((s) => s.setShortcutsModalOpen);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const isAiGenerating = useWorkspaceStore((s) => s.isAiGenerating);
  const historyList = useWorkspaceStore((s) => s.historyList);

  const activeSession = sessions[activeSessionId];
  const notesCount = activeSession?.notes?.sections?.length || 0;
  const currentPage = activeSession?.currentPage || 1;
  const totalPages = activeSession?.document?.pageCount || 1;

  // Resizing state
  const isDraggingLeftRef = useRef(false);
  const isDraggingRightRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize workspace on load
  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      // Escape exits fullscreen
      if (e.key === 'Escape' && fullscreenPanel !== 'none') {
        e.preventDefault();
        setFullscreenPanel('none');
        return;
      }

      // Save: Ctrl+S / Cmd+S
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentSessionNow();
        return;
      }

      // Undo / Redo for notes outside text inputs
      if (isCmdOrCtrl && !isEditingText) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redoNotes();
          } else {
            undoNotes();
          }
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redoNotes();
          return;
        }
      }

      // Help: ?
      if (e.key === '?' && !isEditingText) {
        e.preventDefault();
        setShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    fullscreenPanel,
    setFullscreenPanel,
    saveCurrentSessionNow,
    undoNotes,
    redoNotes,
    setShortcutsModalOpen,
  ]);

  // Mouse drag handlers for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!isDraggingLeftRef.current && !isDraggingRightRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      if (containerWidth <= 0) return;

      const mouseX = e.clientX - containerRect.left;
      const mousePercent = (mouseX / containerWidth) * 100;

      if (isDraggingLeftRef.current) {
        // Adjust PDF width: clamped between 20% and 55%
        const clampedPdfWidth = Math.max(20, Math.min(55, Math.round(mousePercent)));
        const maxAllowedPdf = 100 - panelLayout.notesWidthPercent - 25;
        const finalPdf = Math.min(clampedPdfWidth, maxAllowedPdf);
        updatePanelLayout({ pdfWidthPercent: finalPdf });
      } else if (isDraggingRightRef.current) {
        // Adjust Notes width from right edge: clamped between 20% and 55%
        const notesWidth = 100 - mousePercent;
        const clampedNotesWidth = Math.max(20, Math.min(55, Math.round(notesWidth)));
        const maxAllowedNotes = 100 - panelLayout.pdfWidthPercent - 25;
        const finalNotes = Math.min(clampedNotesWidth, maxAllowedNotes);
        updatePanelLayout({ notesWidthPercent: finalNotes });
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLeftRef.current || isDraggingRightRef.current) {
        isDraggingLeftRef.current = false;
        isDraggingRightRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panelLayout.pdfWidthPercent, panelLayout.notesWidthPercent, updatePanelLayout]);

  const handleStartDragLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeftRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleStartDragRight = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRightRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResetLayout = () => {
    updatePanelLayout({
      pdfWidthPercent: 35,
      notesWidthPercent: 35,
      isPdfCollapsed: false,
      isNotesCollapsed: false,
    });
  };

  // Fullscreen view overrides
  if (fullscreenPanel === 'pdf') {
    return (
      <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden font-sans">
        <div className="h-10 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">PDF Reader — Fullscreen Mode</span>
            <span className="text-slate-400">({activeSession?.document?.title})</span>
          </div>
          <button
            onClick={() => setFullscreenPanel('none')}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition font-medium"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Exit Fullscreen (Esc)
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <PDFPanel />
        </div>
      </div>
    );
  }

  if (fullscreenPanel === 'notes') {
    return (
      <div className="h-screen w-screen flex flex-col bg-white overflow-hidden font-sans">
        <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-900">Notes Editor — Distraction-Free Fullscreen</span>
            <span className="text-slate-500">({activeSession?.notes?.title})</span>
          </div>
          <button
            onClick={() => setFullscreenPanel('none')}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs transition font-medium"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Exit Fullscreen (Esc)
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <NotesPanel />
        </div>
      </div>
    );
  }

  // Calculate panel widths
  const effectivePdfWidth = panelLayout.isPdfCollapsed ? 0 : panelLayout.pdfWidthPercent;
  const effectiveNotesWidth = panelLayout.isNotesCollapsed ? 0 : panelLayout.notesWidthPercent;
  const centerChatWidth = 100 - effectivePdfWidth - effectiveNotesWidth;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden select-text">
      {/* Top Header */}
      <Header />

      {/* Main Desktop Workspace with Study History Sidebar + 3 Columns */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PERSISTENT STUDY HISTORY SIDEBAR (Desktop) */}
        <div className="hidden lg:flex shrink-0">
          <HistorySidebar />
        </div>

        {/* DESKTOP 3-PANEL WORKSPACE (Hidden on mobile <1024px) */}
        <div ref={containerRef} className="hidden lg:flex flex-1 h-full overflow-hidden">
          {/* LEFT: PDF PANEL OR COLLAPSED RAIL */}
          {panelLayout.isPdfCollapsed ? (
            <div className="w-10 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 justify-between shrink-0 transition-all">
              <button
                onClick={() => updatePanelLayout({ isPdfCollapsed: false })}
                title="Expand PDF Reader"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
              >
                <PanelLeftOpen className="w-5 h-5 text-emerald-400" />
              </button>
              <div className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold uppercase tracking-wider text-slate-400">
                PDF Reader
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                p.{currentPage}
              </div>
            </div>
          ) : (
            <div
              style={{ width: `${effectivePdfWidth}%` }}
              className="h-full flex flex-col border-r border-slate-200 bg-slate-900 shrink-0 transition-[width] duration-75"
            >
              <PDFPanel />
            </div>
          )}

          {/* LEFT RESIZER DIVIDER */}
          {!panelLayout.isPdfCollapsed && (
            <div
              onMouseDown={handleStartDragLeft}
              onDoubleClick={handleResetLayout}
              title="Drag to resize PDF / AI panels (Double-click to reset)"
              className="w-1.5 hover:w-2 bg-slate-200 hover:bg-emerald-500 active:bg-emerald-600 transition-colors cursor-col-resize shrink-0 z-20 relative group"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded bg-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* CENTER: AI TUTOR PANEL */}
          <div
            style={{ width: `${centerChatWidth}%` }}
            className="h-full flex flex-col bg-white overflow-hidden shrink-0 transition-[width] duration-75"
          >
            <ChatPanel />
          </div>

          {/* RIGHT RESIZER DIVIDER */}
          {!panelLayout.isNotesCollapsed && (
            <div
              onMouseDown={handleStartDragRight}
              onDoubleClick={handleResetLayout}
              title="Drag to resize AI / Notes panels (Double-click to reset)"
              className="w-1.5 hover:w-2 bg-slate-200 hover:bg-emerald-500 active:bg-emerald-600 transition-colors cursor-col-resize shrink-0 z-20 relative group"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded bg-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* RIGHT: NOTES PANEL OR COLLAPSED RAIL */}
          {panelLayout.isNotesCollapsed ? (
            <div className="w-10 bg-slate-50 border-l border-slate-200 flex flex-col items-center py-4 justify-between shrink-0 transition-all">
              <button
                onClick={() => updatePanelLayout({ isNotesCollapsed: false })}
                title="Expand Notes Editor"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition"
              >
                <PanelRightOpen className="w-5 h-5 text-emerald-600" />
              </button>
              <div className="[writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-wider text-slate-500">
                Notes Editor
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {notesCount} sec
              </div>
            </div>
          ) : (
            <div
              style={{ width: `${effectiveNotesWidth}%` }}
              className="h-full flex flex-col border-l border-slate-200 bg-white shrink-0 transition-[width] duration-75"
            >
              <NotesPanel />
            </div>
          )}
        </div>

        {/* MOBILE / TABLET VIEW (<1024px Tabbed View) */}
        <div className="flex lg:hidden flex-col w-full h-full overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {mobileActiveTab === 'history' && <HistorySidebar />}
            {mobileActiveTab === 'pdf' && <PDFPanel />}
            {mobileActiveTab === 'chat' && <ChatPanel />}
            {mobileActiveTab === 'notes' && <NotesPanel />}
          </div>

          {/* Mobile Bottom Tab Navigation */}
          <nav className="h-14 bg-white border-t border-slate-200 flex items-center justify-around px-2 shrink-0 z-20">
            <button
              onClick={() => setMobileActiveTab('history')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition ${
                mobileActiveTab === 'history'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Clock className="w-5 h-5" />
                {historyList.length > 0 && (
                  <span className="absolute -top-1 -right-2 text-[9px] bg-slate-200 text-slate-700 rounded-full px-1">
                    {historyList.length}
                  </span>
                )}
              </div>
              <span>History</span>
            </button>

            <button
              onClick={() => setMobileActiveTab('pdf')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition ${
                mobileActiveTab === 'pdf'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <BookOpen className="w-5 h-5" />
                <span className="absolute -top-1 -right-2 text-[9px] bg-slate-200 text-slate-700 rounded-full px-1">
                  {currentPage}/{totalPages}
                </span>
              </div>
              <span>PDF Viewer</span>
            </button>

            <button
              onClick={() => setMobileActiveTab('chat')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition ${
                mobileActiveTab === 'chat'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5" />
                {isAiGenerating && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                )}
              </div>
              <span>AI Tutor</span>
            </button>

            <button
              onClick={() => setMobileActiveTab('notes')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition ${
                mobileActiveTab === 'notes'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <FileText className="w-5 h-5" />
                {notesCount > 0 && (
                  <span className="absolute -top-1 -right-2 text-[9px] bg-emerald-100 text-emerald-800 font-semibold rounded-full px-1">
                    {notesCount}
                  </span>
                )}
              </div>
              <span>Notes Editor</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Global Workspace Modals (Shortcuts, Sessions, Auth, Versions) */}
      <WorkspaceModals />
    </div>
  );
}
