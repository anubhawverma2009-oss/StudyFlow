import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  BookMarked,
  Check,
  ChevronDown,
  Code,
  Copy,
  FileCode,
  FileText,
  History,
  Italic,
  Lightbulb,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelRightClose,
  Plus,
  Redo2,
  Sigma,
  Sparkles,
  Table,
  Trash2,
  Underline,
  Undo2,
  Wand2,
} from 'lucide-react';
import { copyNotesToClipboard } from '../../services/notes/exportService';
import { notesToMarkdown } from '../../services/notes/noteEngine';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import {
  NoteBlock,
  NoteBlockType,
  NoteSection,
  SubjectType,
} from '../../types/workspace';

export const NotesPanel: React.FC = () => {
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const isAiGenerating = useWorkspaceStore((s) => s.isAiGenerating);
  const notesViewMode = useWorkspaceStore((s) => s.notesViewMode);
  const setNotesViewMode = useWorkspaceStore((s) => s.setNotesViewMode);
  const triggerGenerateNotes = useWorkspaceStore((s) => s.triggerGenerateNotes);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const updateNotesDocumentManual = useWorkspaceStore((s) => s.updateNotesDocumentManual);
  const updateSectionManual = useWorkspaceStore((s) => s.updateSectionManual);
  const addCustomSectionManual = useWorkspaceStore((s) => s.addCustomSectionManual);
  const deleteSectionManual = useWorkspaceStore((s) => s.deleteSectionManual);
  const moveSectionOrder = useWorkspaceStore((s) => s.moveSectionOrder);
  const addBlockToSectionManual = useWorkspaceStore((s) => s.addBlockToSectionManual);
  const undoNotes = useWorkspaceStore((s) => s.undoNotes);
  const redoNotes = useWorkspaceStore((s) => s.redoNotes);
  const setVersionDrawerOpen = useWorkspaceStore((s) => s.setVersionDrawerOpen);
  const setCurrentPage = useWorkspaceStore((s) => s.setCurrentPage);
  const fullscreenPanel = useWorkspaceStore((s) => s.fullscreenPanel);
  const setFullscreenPanel = useWorkspaceStore((s) => s.setFullscreenPanel);
  const updatePanelLayout = useWorkspaceStore((s) => s.updatePanelLayout);

  const activeSession = sessions[activeSessionId];
  const notes = activeSession?.notes;

  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [activeSectionMenuId, setActiveSectionMenuId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState('');

  const canUndo = activeSession ? activeSession.versionIndex > 0 : false;
  const canRedo = activeSession
    ? activeSession.versionIndex < activeSession.noteVersions.length - 1
    : false;

  const handleSwitchToMarkdown = () => {
    if (!notes) return;
    setMarkdownDraft(notesToMarkdown(notes));
    setNotesViewMode('markdown');
  };

  const handleCopyAll = async () => {
    if (!notes) return;
    const ok = await copyNotesToClipboard(notes);
    if (ok) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 1800);
    }
  };

  const handleInsertBlock = (sectionId: string, blockType: NoteBlockType) => {
    const pageNum = activeSession?.currentPage || 1;
    const newBlock: NoteBlock = {
      id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: blockType,
      title:
        blockType === 'definition'
          ? 'Key Term'
          : blockType === 'formula'
          ? 'Equation / Formula'
          : blockType === 'example'
          ? 'Worked Example'
          : blockType === 'exam_tip'
          ? 'Exam Tip'
          : blockType === 'table'
          ? 'Comparison Table'
          : undefined,
      content:
        blockType === 'formula'
          ? 'f(x) = ...'
          : blockType === 'code'
          ? '// Write code snippet here'
          : 'Enter study note content here...',
      items:
        blockType === 'bullet_list' || blockType === 'numbered_list'
          ? ['First key point', 'Second key point']
          : undefined,
      tableData:
        blockType === 'table'
          ? {
              headers: ['Concept / Feature', 'Mechanism A', 'Mechanism B'],
              rows: [
                ['Primary Property', 'Value 1', 'Value 2'],
                ['Exam Takeaway', 'Detail A', 'Detail B']
              ]
            }
          : undefined,
      pageRef: pageNum
    };

    addBlockToSectionManual(sectionId, newBlock);
    setActiveSectionMenuId(null);
    setIsInsertMenuOpen(false);
  };

  const handleUpdateBlock = (
    section: NoteSection,
    blockId: string,
    updater: (blk: NoteBlock) => NoteBlock
  ) => {
    const updatedBlocks = section.blocks.map((b) => (b.id === blockId ? updater(b) : b));
    updateSectionManual(section.id, {
      ...section,
      blocks: updatedBlocks
    });
  };

  const handleDeleteBlock = (section: NoteSection, blockId: string) => {
    if (section.blocks.length <= 1) return;
    updateSectionManual(section.id, {
      ...section,
      blocks: section.blocks.filter((b) => b.id !== blockId)
    });
  };

  const wrapSelectionWithTag = (prefix: string, suffix: string) => {
    const activeEl = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
    if (
      activeEl &&
      (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') &&
      typeof activeEl.selectionStart === 'number'
    ) {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd || start;
      const val = activeEl.value;
      const selected = val.slice(start, end) || 'text';
      const nextVal = val.slice(0, start) + prefix + selected + suffix + val.slice(end);
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      nativeInputValueSetter?.call(activeEl, nextVal);
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <section
      aria-label="Structured Notes Editor"
      className="flex flex-col h-full bg-white overflow-hidden"
    >
      <div className="h-11 border-b border-slate-200 px-3 flex items-center justify-between gap-2 bg-white shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => triggerGenerateNotes()}
            disabled={!activeSession || isAiGenerating}
            className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45"
          >
            {isAiGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Generate Notes</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={undoNotes}
            disabled={!canUndo}
            title="Undo Note Change (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={redoNotes}
            disabled={!canRedo}
            title="Redo Note Change (Ctrl+Shift+Z)"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {activeSession && (
            <button
              type="button"
              onClick={() => setVersionDrawerOpen(true)}
              title="Open Note Version History"
              className="px-2 py-1 rounded text-[11px] font-mono tabular-nums text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <History className="w-3 h-3 text-slate-400" />
              <span>
                v{activeSession.versionIndex + 1}/{activeSession.noteVersions.length}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200/70">
            <button
              type="button"
              onClick={() => setNotesViewMode('rich')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                notesViewMode === 'rich'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={handleSwitchToMarkdown}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                notesViewMode === 'markdown'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Markdown
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            disabled={!notes}
            title="Copy Notes as Markdown"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {copiedSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setFullscreenPanel(fullscreenPanel === 'notes' ? 'none' : 'notes')
            }
            title={fullscreenPanel === 'notes' ? 'Exit Fullscreen' : 'Fullscreen Notes'}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 hidden md:inline-flex"
          >
            {fullscreenPanel === 'notes' ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {fullscreenPanel === 'none' && (
            <button
              type="button"
              onClick={() => updatePanelLayout({ isNotesCollapsed: true })}
              title="Collapse Notes Panel"
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 hidden lg:inline-flex"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {notes && notesViewMode === 'rich' && (
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 select-none">
          <div className="flex items-center gap-1">
            {/* Frequently Used Formatting Tools Visible */}
            <button
              type="button"
              onClick={() => wrapSelectionWithTag('**', '**')}
              title="Bold (**text**)"
              className="p-1 rounded hover:bg-slate-200/70 text-slate-700 cursor-pointer"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelectionWithTag('*', '*')}
              title="Italic (*text*)"
              className="p-1 rounded hover:bg-slate-200/70 text-slate-700 cursor-pointer"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelectionWithTag('<u>', '</u>')}
              title="Underline"
              className="p-1 rounded hover:bg-slate-200/70 text-slate-700 cursor-pointer"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelectionWithTag('`', '`')}
              title="Inline Code"
              className="p-1 rounded hover:bg-slate-200/70 text-slate-700 cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            <div className="h-3.5 w-px bg-slate-300 mx-1" />

            {/* Frequently used Undo / Redo */}
            <button
              type="button"
              onClick={undoNotes}
              disabled={!canUndo}
              title="Undo note edit (Ctrl+Z)"
              className="p-1 rounded hover:bg-slate-200/70 text-slate-600 disabled:opacity-30 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={redoNotes}
              disabled={!canRedo}
              title="Redo note edit (Ctrl+Y)"
              className="p-1 rounded hover:bg-slate-200/70 text-slate-600 disabled:opacity-30 cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <div className="h-3.5 w-px bg-slate-300 mx-1" />

            {/* Advanced Insert Actions under Clean "Insert ▾" Dropdown (Requirement 12) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsInsertMenuOpen((v) => !v)}
                className="px-2 py-0.5 rounded hover:bg-slate-200/80 text-[11px] font-medium text-slate-700 inline-flex items-center gap-1 cursor-pointer bg-white border border-slate-200"
                title="Insert special blocks (Definition, Formula, Table, Exam Tip...)"
              >
                <Plus className="w-3 h-3 text-slate-500" />
                <span>Insert</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {isInsertMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsInsertMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40 text-xs text-slate-700 animate-in fade-in duration-75">
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      Insert Block
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'definition');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <BookMarked className="w-3.5 h-3.5 text-blue-600" />
                      <span>Definition Box</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'formula');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Sigma className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Formula / Equation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'table');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Table className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Comparison Table</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'exam_tip');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span>Exam Tip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'example');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>Worked Example</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'code');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-slate-700" />
                      <span>Code Block</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'bullet_list');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <List className="w-3.5 h-3.5 text-slate-500" />
                      <span>Bullet List</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInsertMenuOpen(false);
                        const targetSec = notes.sections[notes.sections.length - 1];
                        if (targetSec) handleInsertBlock(targetSec.id, 'numbered_list');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <ListOrdered className="w-3.5 h-3.5 text-slate-500" />
                      <span>Numbered List</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* + Section Action */}
          <button
            type="button"
            onClick={() => setIsAddingSection(true)}
            className="px-2.5 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-medium text-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3" />
            <span>Section</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
        {!notes ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <FileText className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-700">
              No study notes active. Upload or open a PDF to generate structured notes.
            </p>
          </div>
        ) : notesViewMode === 'markdown' ? (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Markdown Source View — Copy or edit raw Markdown</span>
              <button
                type="button"
                onClick={() => setNotesViewMode('rich')}
                className="text-blue-700 font-medium hover:underline"
              >
                Return to Structured Block Editor
              </button>
            </div>
            <textarea
              value={markdownDraft}
              onChange={(e) => setMarkdownDraft(e.target.value)}
              className="flex-1 w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800 leading-relaxed focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>
        ) : (
          <>
            <div className="border-b border-slate-200 pb-4 space-y-2">
              <input
                type="text"
                value={notes.title}
                onChange={(e) =>
                  updateNotesDocumentManual(
                    { ...notes, title: e.target.value },
                    'Renamed Notes Title'
                  )
                }
                aria-label="Notes document title"
                className="w-full font-display text-xl font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none pb-0.5"
              />

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Subject Template:</span>
                <select
                  value={notes.subjectType}
                  onChange={(e) =>
                    updateNotesDocumentManual(
                      { ...notes, subjectType: e.target.value as SubjectType },
                      `Changed subject template to ${e.target.value}`
                    )
                  }
                  className="bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="theory">Theory &amp; Concepts</option>
                  <option value="mathematics">Mathematics &amp; Derivations</option>
                  <option value="programming">Programming &amp; Algorithms</option>
                  <option value="general">General Academic</option>
                </select>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{notes.sections.length} sections</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Revision v{notes.version}</span>
              </div>
            </div>

            {isAddingSection && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newSectionTitle.trim()) {
                    addCustomSectionManual(newSectionTitle.trim());
                    setNewSectionTitle('');
                    setIsAddingSection(false);
                  }
                }}
                className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="New section heading (e.g., Solved Examples, 5-Mark Exam Answers)..."
                  autoFocus
                  className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-medium"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSection(false)}
                  className="px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </form>
            )}

            <div className="space-y-6">
              {notes.sections.map((section, secIndex) => (
                <div
                  key={section.id}
                  className="group border border-slate-200 rounded-lg bg-white p-4 transition-colors hover:border-slate-300"
                >
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums shrink-0">
                        0{secIndex + 1}.
                      </span>
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) =>
                          updateSectionManual(section.id, {
                            ...section,
                            heading: e.target.value
                          })
                        }
                        className="font-display text-base font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none w-full truncate"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {section.pageRefs && section.pageRefs.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono tabular-nums text-slate-400">
                          {section.pageRefs.slice(0, 3).map((pNum) => (
                            <button
                              key={pNum}
                              type="button"
                              onClick={() => setCurrentPage(pNum)}
                              className="hover:text-emerald-700 hover:underline"
                              title={`Jump to Page ${pNum} in PDF`}
                            >
                              p.{pNum}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Single Contextual ⋯ Menu for Section (Requirement 13) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSectionMenuId(
                              activeSectionMenuId === section.id ? null : section.id
                            )
                          }
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Section options: AI edit, Insert block, Move, Delete"
                          aria-label="Section options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {activeSectionMenuId === section.id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setActiveSectionMenuId(null)}
                            />
                            <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-40 text-xs text-slate-700 animate-in fade-in duration-75">
                              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                AI Section Refinement
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  sendMessage(
                                    `Change only the "${section.heading}" section to make it simpler and easier for a beginner to understand.`,
                                    {
                                      forceMode: 'change_notes',
                                      targetSectionHeading: section.heading,
                                    }
                                  );
                                }}
                                disabled={isAiGenerating}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer disabled:opacity-40"
                              >
                                <Wand2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Simplify this section</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  sendMessage(
                                    `Add a concrete worked example to the "${section.heading}" section based on Page ${
                                      activeSession?.currentPage || 1
                                    }.`,
                                    {
                                      forceMode: 'change_notes',
                                      targetSectionHeading: section.heading,
                                    }
                                  );
                                }}
                                disabled={isAiGenerating}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer disabled:opacity-40"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                <span>Add worked example</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  sendMessage(
                                    `Make the "${section.heading}" section more concise and exam-oriented.`,
                                    {
                                      forceMode: 'change_notes',
                                      targetSectionHeading: section.heading,
                                    }
                                  );
                                }}
                                disabled={isAiGenerating}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer disabled:opacity-40"
                              >
                                <Check className="w-3.5 h-3.5 text-blue-600" />
                                <span>Make concise for exams</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  sendMessage(
                                    `Convert only the "${section.heading}" section into easy-to-understand Hinglish.`,
                                    {
                                      forceMode: 'change_notes',
                                      targetSectionHeading: section.heading,
                                    }
                                  );
                                }}
                                disabled={isAiGenerating}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer disabled:opacity-40"
                              >
                                <BookMarked className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Convert to Hinglish</span>
                              </button>

                              <div className="my-1 border-t border-slate-100" />

                              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Insert Block Here
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  handleInsertBlock(section.id, 'paragraph');
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                <span>Paragraph</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  handleInsertBlock(section.id, 'bullet_list');
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <List className="w-3.5 h-3.5 text-slate-500" />
                                <span>Bullet List</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  handleInsertBlock(section.id, 'definition');
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <BookMarked className="w-3.5 h-3.5 text-blue-600" />
                                <span>Definition Box</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  handleInsertBlock(section.id, 'formula');
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Sigma className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Formula Block</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  handleInsertBlock(section.id, 'table');
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Table className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Comparison Table</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  handleInsertBlock(section.id, 'exam_tip');
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                                <span>Exam Tip</span>
                              </button>

                              <div className="my-1 border-t border-slate-100" />

                              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Reorder Section
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  moveSectionOrder(section.id, 'up');
                                }}
                                disabled={secIndex === 0}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer disabled:opacity-30"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
                                <span>Move Up</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionMenuId(null);
                                  moveSectionOrder(section.id, 'down');
                                }}
                                disabled={secIndex === notes.sections.length - 1}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 cursor-pointer disabled:opacity-30"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
                                <span>Move Down</span>
                              </button>

                              {notes.sections.length > 1 && (
                                <>
                                  <div className="my-1 border-t border-slate-100" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSectionMenuId(null);
                                      deleteSectionManual(section.id);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete Section</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {section.blocks.map((block) => (
                      <div key={block.id} className="relative group/block">
                        {section.blocks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(section, block.id)}
                            title="Remove block"
                            className="opacity-0 group-hover/block:opacity-100 absolute -right-1.5 -top-1.5 p-1 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-600 shadow-2xs transition-opacity z-10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}

                        {block.type === 'paragraph' && (
                          <textarea
                            rows={Math.max(2, Math.ceil(block.content.length / 75))}
                            value={block.content}
                            onChange={(e) =>
                              handleUpdateBlock(section, block.id, (b) => ({
                                ...b,
                                content: e.target.value
                              }))
                            }
                            className="w-full text-xs leading-relaxed text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 rounded p-1.5 focus:outline-none resize-y"
                          />
                        )}

                        {(block.type === 'bullet_list' || block.type === 'numbered_list') && (
                          <div className="space-y-1.5 pl-1">
                            {block.title !== undefined && (
                              <input
                                type="text"
                                value={block.title}
                                onChange={(e) =>
                                  handleUpdateBlock(section, block.id, (b) => ({
                                    ...b,
                                    title: e.target.value
                                  }))
                                }
                                placeholder="List heading (optional)..."
                                className="w-full text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent focus:border-blue-600 focus:outline-none pb-0.5"
                              />
                            )}
                            {(block.items || []).map((item, itemIdx) => (
                              <div key={itemIdx} className="flex items-start gap-2">
                                <span className="text-xs font-mono text-blue-700 font-semibold mt-1.5 shrink-0">
                                  {block.type === 'numbered_list' ? `${itemIdx + 1}.` : '•'}
                                </span>
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => {
                                    const nextItems = [...(block.items || [])];
                                    nextItems[itemIdx] = e.target.value;
                                    handleUpdateBlock(section, block.id, (b) => ({
                                      ...b,
                                      items: nextItems
                                    }));
                                  }}
                                  className="flex-1 text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 rounded px-1.5 py-1 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextItems = (block.items || []).filter(
                                      (_, i) => i !== itemIdx
                                    );
                                    handleUpdateBlock(section, block.id, (b) => ({
                                      ...b,
                                      items: nextItems
                                    }));
                                  }}
                                  className="opacity-0 group-hover/block:opacity-100 p-1 text-slate-300 hover:text-red-500"
                                  title="Remove item"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  items: [...(b.items || []), 'New point...']
                                }))
                              }
                              className="text-[11px] text-blue-700 hover:underline pl-4 inline-flex items-center gap-1"
                            >
                              + Add item
                            </button>
                          </div>
                        )}

                        {block.type === 'definition' && (
                          <div className="border-l-3 border-blue-600 bg-blue-50/50 rounded-r-lg p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-semibold text-blue-700 uppercase">
                                Definition
                              </span>
                              <input
                                type="text"
                                value={block.title || ''}
                                onChange={(e) =>
                                  handleUpdateBlock(section, block.id, (b) => ({
                                    ...b,
                                    title: e.target.value
                                  }))
                                }
                                placeholder="Term name..."
                                className="flex-1 text-xs font-semibold text-slate-900 bg-transparent border-b border-transparent focus:border-blue-600 focus:outline-none"
                              />
                            </div>
                            <textarea
                              rows={2}
                              value={block.content}
                              onChange={(e) =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  content: e.target.value
                                }))
                              }
                              className="w-full text-xs text-slate-700 bg-transparent focus:outline-none resize-y leading-relaxed"
                            />
                          </div>
                        )}

                        {block.type === 'formula' && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                            <input
                              type="text"
                              value={block.title || ''}
                              onChange={(e) =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  title: e.target.value
                                }))
                              }
                              placeholder="Formula name..."
                              className="w-full text-[11px] font-semibold text-slate-600 bg-transparent focus:outline-none"
                            />
                            <textarea
                              rows={2}
                              value={block.content}
                              onChange={(e) =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  content: e.target.value
                                }))
                              }
                              className="w-full font-mono text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 resize-y"
                            />
                          </div>
                        )}

                        {block.type === 'example' && (
                          <div className="border-l-3 border-emerald-600 bg-emerald-50/50 rounded-r-lg p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-semibold text-emerald-800 uppercase">
                                Example
                              </span>
                              <input
                                type="text"
                                value={block.title || ''}
                                onChange={(e) =>
                                  handleUpdateBlock(section, block.id, (b) => ({
                                    ...b,
                                    title: e.target.value
                                  }))
                                }
                                placeholder="Example title..."
                                className="flex-1 text-xs font-semibold text-slate-900 bg-transparent focus:outline-none"
                              />
                            </div>
                            <textarea
                              rows={3}
                              value={block.content}
                              onChange={(e) =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  content: e.target.value
                                }))
                              }
                              className="w-full text-xs text-slate-700 bg-transparent focus:outline-none resize-y leading-relaxed"
                            />
                          </div>
                        )}

                        {(block.type === 'exam_tip' || block.type === 'callout') && (
                          <div className="border-l-3 border-amber-500 bg-amber-50/60 rounded-r-lg p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <input
                                type="text"
                                value={block.title || 'Exam Tip'}
                                onChange={(e) =>
                                  handleUpdateBlock(section, block.id, (b) => ({
                                    ...b,
                                    title: e.target.value
                                  }))
                                }
                                className="flex-1 text-xs font-semibold text-amber-950 bg-transparent focus:outline-none"
                              />
                            </div>
                            <textarea
                              rows={2}
                              value={block.content}
                              onChange={(e) =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  content: e.target.value
                                }))
                              }
                              className="w-full text-xs text-amber-950/90 bg-transparent focus:outline-none resize-y leading-relaxed"
                            />
                          </div>
                        )}

                        {block.type === 'code' && (
                          <div className="bg-slate-900 text-slate-100 rounded-lg p-3 space-y-1.5">
                            <input
                              type="text"
                              value={block.title || 'Code Example'}
                              onChange={(e) =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  title: e.target.value
                                }))
                              }
                              className="w-full text-[11px] font-mono text-slate-400 bg-transparent focus:outline-none"
                            />
                            <textarea
                              rows={4}
                              value={block.content}
                              onChange={(e) =>
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  content: e.target.value
                                }))
                              }
                              className="w-full font-mono text-xs text-slate-100 bg-transparent focus:outline-none resize-y"
                            />
                          </div>
                        )}

                        {block.type === 'table' && block.tableData && (
                          <div className="space-y-1.5 overflow-x-auto">
                            {block.title && (
                              <input
                                type="text"
                                value={block.title}
                                onChange={(e) =>
                                  handleUpdateBlock(section, block.id, (b) => ({
                                    ...b,
                                    title: e.target.value
                                  }))
                                }
                                className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:outline-none"
                              />
                            )}
                            <table className="w-full border-collapse border border-slate-200 text-xs">
                              <thead>
                                <tr className="bg-slate-100">
                                  {block.tableData.headers.map((hdr, hIdx) => (
                                    <th
                                      key={hIdx}
                                      className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-800"
                                    >
                                      <input
                                        type="text"
                                        value={hdr}
                                        onChange={(e) => {
                                          const nextHeaders = [...block.tableData!.headers];
                                          nextHeaders[hIdx] = e.target.value;
                                          handleUpdateBlock(section, block.id, (b) => ({
                                            ...b,
                                            tableData: {
                                              ...b.tableData!,
                                              headers: nextHeaders
                                            }
                                          }));
                                        }}
                                        className="w-full bg-transparent font-semibold focus:outline-none"
                                      />
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.tableData.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-slate-50">
                                    {row.map((cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className="border border-slate-200 px-2 py-1 text-slate-700"
                                      >
                                        <input
                                          type="text"
                                          value={cell}
                                          onChange={(e) => {
                                            const nextRows = block.tableData!.rows.map((r) => [
                                              ...r
                                            ]);
                                            nextRows[rIdx][cIdx] = e.target.value;
                                            handleUpdateBlock(section, block.id, (b) => ({
                                              ...b,
                                              tableData: {
                                                ...b.tableData!,
                                                rows: nextRows
                                              }
                                            }));
                                          }}
                                          className="w-full bg-transparent focus:outline-none"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <button
                              type="button"
                              onClick={() => {
                                const emptyRow = block.tableData!.headers.map(() => '—');
                                handleUpdateBlock(section, block.id, (b) => ({
                                  ...b,
                                  tableData: {
                                    ...b.tableData!,
                                    rows: [...b.tableData!.rows, emptyRow]
                                  }
                                }));
                              }}
                              className="text-[11px] text-blue-700 hover:underline"
                            >
                              + Add Table Row
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
