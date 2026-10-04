import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  FileEdit,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PlusCircle,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { QuickActionType } from '../../types/workspace';

export const ChatPanel: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const aiMode = useWorkspaceStore((s) => s.aiMode);
  const setAiMode = useWorkspaceStore((s) => s.setAiMode);
  const isAiGenerating = useWorkspaceStore((s) => s.isAiGenerating);
  const aiStatusText = useWorkspaceStore((s) => s.aiStatusText);
  const selectedPdfText = useWorkspaceStore((s) => s.selectedPdfText);
  const setSelectedPdfText = useWorkspaceStore((s) => s.setSelectedPdfText);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const stopAiGeneration = useWorkspaceStore((s) => s.stopAiGeneration);
  const clearConversation = useWorkspaceStore((s) => s.clearConversation);
  const setCurrentPage = useWorkspaceStore((s) => s.setCurrentPage);
  const addTextOrExplanationToNotes = useWorkspaceStore((s) => s.addTextOrExplanationToNotes);
  const undoNotes = useWorkspaceStore((s) => s.undoNotes);
  const updatePanelLayout = useWorkspaceStore((s) => s.updatePanelLayout);

  const activeSession = sessions[activeSessionId];
  const currentPage = activeSession?.currentPage || 1;

  const [inputPrompt, setInputPrompt] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length, isAiGenerating]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isAiGenerating || !activeSession) return;
    const text = inputPrompt;
    setInputPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = async (action: QuickActionType) => {
    if (!activeSession || isAiGenerating) return;
    const contextTarget = selectedPdfText
      ? `this selected text on Page ${currentPage} ("${selectedPdfText.slice(0, 120)}...")`
      : `Page ${currentPage}`;

    switch (action) {
      case 'explain':
        setAiMode('ask');
        await sendMessage(
          `Explain ${contextTarget} in simple terms with a concrete example and key takeaway.`,
          { forceMode: 'ask', quickAction: 'explain' }
        );
        break;
      case 'summarize':
        setAiMode('ask');
        await sendMessage(`Summarize the key points on ${contextTarget} concisely.`, {
          forceMode: 'ask',
          quickAction: 'summarize'
        });
        break;
      case 'make_notes':
        setAiMode('change_notes');
        await sendMessage(
          `Convert the concepts on ${contextTarget} into structured exam-oriented notes.`,
          { forceMode: 'change_notes', quickAction: 'make_notes' }
        );
        break;
      case 'important_points':
        setAiMode('ask');
        await sendMessage(
          `What are the most important exam points and definitions to remember from ${contextTarget}?`,
          { forceMode: 'ask', quickAction: 'important_points' }
        );
        break;
      case 'exam_questions':
        setAiMode('change_notes');
        await sendMessage(
          `Add a section with important exam questions and concise answers based on ${contextTarget}.`,
          { forceMode: 'change_notes', quickAction: 'exam_questions' }
        );
        break;
      case 'examples':
        if (aiMode === 'change_notes') {
          await sendMessage(`Add a clear worked example from ${contextTarget} into my notes.`, {
            forceMode: 'change_notes',
            quickAction: 'examples'
          });
        } else {
          await sendMessage(
            `Give me a simple, practical example to understand the concept on ${contextTarget}.`,
            { forceMode: 'ask', quickAction: 'examples' }
          );
        }
        break;
      case 'hinglish':
        if (aiMode === 'change_notes') {
          await sendMessage(
            `Convert the Overview or current topic notes from ${contextTarget} into easy-to-read Hinglish.`,
            { forceMode: 'change_notes', quickAction: 'hinglish' }
          );
        } else {
          await sendMessage(`Explain ${contextTarget} in simple Hinglish so it is easy to grasp.`, {
            forceMode: 'ask',
            quickAction: 'hinglish'
          });
        }
        break;
      case 'make_simple':
        if (aiMode === 'change_notes') {
          await sendMessage(
            `Make my current notes easier to understand and more concise without losing key formulas.`,
            { forceMode: 'change_notes', quickAction: 'make_simple' }
          );
        } else {
          await sendMessage(`Explain ${contextTarget} like I am a complete beginner.`, {
            forceMode: 'ask',
            quickAction: 'make_simple'
          });
        }
        break;
    }
  };

  const renderFormattedContent = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-xs font-bold text-slate-900 mt-2.5 mb-1">
            {trimmed.replace('### ', '')}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-slate-900 mt-3 mb-1">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="border-l-2 border-blue-500 bg-blue-50/50 pl-2.5 py-1 my-1.5 text-xs text-slate-700 italic rounded-r"
          >
            {renderInlineSegments(trimmed.replace('> ', ''))}
          </blockquote>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={idx} className="flex items-start gap-2 pl-1 my-0.5 text-xs text-slate-700">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <span className="flex-1 leading-relaxed">
              {renderInlineSegments(trimmed.slice(2))}
            </span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
        if (match) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5 text-xs text-slate-700">
              <span className="font-mono text-[11px] font-semibold text-blue-700 mt-0.5 shrink-0">
                {match[1]}
              </span>
              <span className="flex-1 leading-relaxed">{renderInlineSegments(match[2])}</span>
            </div>
          );
        }
      }

      return (
        <p key={idx} className="text-xs leading-relaxed text-slate-700 my-1">
          {renderInlineSegments(line)}
        </p>
      );
    });
  };

  const renderInlineSegments = (text: string) => {
    const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[?Page\s+\d+\]?)/gi);
    return tokens.map((tok, i) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return (
          <code
            key={i}
            className="font-mono text-[11px] bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-slate-800"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      const pageMatch = tok.match(/^\[?Page\s+(\d+)\]?$/i);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1], 10);
        return (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentPage(pageNum)}
            className="inline-flex items-center gap-0.5 font-mono text-[11px] font-medium text-blue-700 hover:text-blue-900 underline decoration-blue-300 underline-offset-2 mx-0.5 cursor-pointer"
            title={`Jump PDF viewer to Page ${pageNum}`}
          >
            Page {pageNum}
          </button>
        );
      }
      return tok;
    });
  };

  return (
    <section
      aria-label="AI Study Tutor"
      className="flex flex-col h-full bg-white border-r border-slate-200 overflow-hidden"
    >
      <div className="border-b border-slate-200 bg-white px-3.5 py-2.5 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-900">AI Study Assistant</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
              Page {currentPage} Context
            </span>
          </div>

          <div className="flex items-center gap-1">
            {activeSession && activeSession.messages.length > 1 && (
              <button
                type="button"
                onClick={clearConversation}
                title="Clear chat conversation (preserves notes)"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => updatePanelLayout({ isChatCollapsed: true })}
              title="Collapse AI Tutor Panel"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors hidden lg:inline-flex"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="AI Assistant Mode"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/70"
        >
          <button
            type="button"
            role="tab"
            aria-selected={aiMode === 'ask'}
            onClick={() => setAiMode('ask')}
            className={`py-1.5 px-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
              aiMode === 'ask'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>Ask / Explain</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={aiMode === 'change_notes'}
            onClick={() => setAiMode('change_notes')}
            className={`py-1.5 px-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
              aiMode === 'change_notes'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5 shrink-0" />
            <span>Change Notes</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center justify-between px-0.5">
          {aiMode === 'ask' ? (
            <span>
              Mode A: Explains concepts &amp; answers questions ·{' '}
              <strong className="font-medium text-slate-700">Never modifies notes</strong>
            </span>
          ) : (
            <span className="text-emerald-800">
              Mode B: Surgically updates your Notes Editor ·{' '}
              <strong className="font-medium">Creates undoable snapshot</strong>
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {(
          [
            { id: 'explain', label: 'Explain' },
            { id: 'summarize', label: 'Summarize' },
            { id: 'make_notes', label: 'Make Notes' },
            { id: 'important_points', label: 'Important Points' },
            { id: 'exam_questions', label: 'Exam Questions' },
            { id: 'examples', label: 'Examples' },
            { id: 'hinglish', label: 'Hinglish' },
            { id: 'make_simple', label: 'Make Simple' }
          ] as { id: QuickActionType; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!activeSession || isAiGenerating}
            onClick={() => handleQuickAction(item.id)}
            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 bg-slate-50/40">
        {!activeSession ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <BookOpen className="w-7 h-7 text-slate-400 mb-2" />
            <p className="text-xs font-medium text-slate-700">
              Upload or select a PDF document to begin asking questions.
            </p>
          </div>
        ) : (
          activeSession.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                  <span className="font-medium text-slate-600">
                    {isUser ? 'You' : 'ScholarSync Tutor'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {msg.mode === 'change_notes' ? 'Change Notes Mode' : 'Ask / Explain Mode'}
                  </span>
                  {msg.pageContext && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(msg.pageContext!)}
                        className="font-mono tabular-nums hover:text-blue-700 underline"
                      >
                        Page {msg.pageContext}
                      </button>
                    </>
                  )}
                </div>

                <div
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 border ${
                    isUser
                      ? msg.mode === 'change_notes'
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-slate-900 text-white border-slate-900'
                      : msg.isError
                      ? 'bg-red-50 text-red-900 border-red-200'
                      : 'bg-white text-slate-800 border-slate-200 shadow-2xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.isError ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs text-red-800">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{msg.content}</span>
                      </div>
                      {msg.retryPayload && (
                        <button
                          type="button"
                          onClick={() =>
                            sendMessage(msg.retryPayload!.prompt, {
                              forceMode: msg.retryPayload!.mode,
                              quickAction: msg.retryPayload!.quickAction,
                              pageImageBase64: msg.retryPayload!.pageImageBase64
                            })
                          }
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-medium inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry Request</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      {renderFormattedContent(msg.content)}

                      {msg.noteChangeSummary && (
                        <div className="mt-3 pt-2.5 border-t border-emerald-100 bg-emerald-50/70 -mx-3.5 -mb-2.5 px-3.5 py-2.5 rounded-b-xl flex items-center justify-between gap-2">
                          <div className="text-[11px] text-emerald-950">
                            <span className="font-semibold">
                              Notes Updated (v{msg.noteChangeSummary.versionCreated}):
                            </span>{' '}
                            <span>{msg.noteChangeSummary.targetSection}</span>
                          </div>
                          <button
                            type="button"
                            onClick={undoNotes}
                            className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            title="Undo this AI note change"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Undo</span>
                          </button>
                        </div>
                      )}

                      {!msg.noteChangeSummary && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiedMsgId(msg.id);
                                setTimeout(() => setCopiedMsgId(null), 1800);
                              }}
                              className="hover:text-slate-700 inline-flex items-center gap-1 transition-colors"
                            >
                              {copiedMsgId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <span aria-hidden="true">·</span>

                            <button
                              type="button"
                              onClick={() =>
                                addTextOrExplanationToNotes(
                                  msg.content,
                                  `AI explanation from Page ${msg.pageContext || currentPage}`
                                )
                              }
                              disabled={isAiGenerating}
                              className="text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-40"
                            >
                              <PlusCircle className="w-3 h-3" />
                              <span>Add to Notes</span>
                            </button>
                          </div>

                          {msg.citedPages && msg.citedPages.length > 0 && (
                            <div className="flex items-center gap-1 font-mono tabular-nums">
                              <span>Refs:</span>
                              {msg.citedPages.map((pNum) => (
                                <button
                                  key={pNum}
                                  type="button"
                                  onClick={() => setCurrentPage(pNum)}
                                  className="text-blue-700 hover:underline"
                                >
                                  p.{pNum}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isAiGenerating && (
          <div className="flex items-start gap-2.5">
            <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 shadow-2xs flex items-center gap-2.5 text-xs text-slate-700">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span>{aiStatusText || 'Thinking...'}</span>
              <button
                type="button"
                onClick={stopAiGeneration}
                className="ml-2 px-2 py-0.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 rounded text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {selectedPdfText && (
        <div className="bg-blue-50/90 border-t border-blue-200 px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs text-blue-950 shrink-0">
          <div className="truncate text-[11px]">
            <span className="font-semibold">Page {currentPage} Selection:</span>{' '}
            <span className="italic">"{selectedPdfText}"</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPdfText('')}
            className="text-blue-600 hover:text-blue-900 p-0.5 shrink-0"
            title="Remove selected text context"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className={`p-3 border-t transition-colors shrink-0 ${
          aiMode === 'change_notes'
            ? 'bg-emerald-50/40 border-emerald-200'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!activeSession}
            placeholder={
              aiMode === 'ask'
                ? `Ask about Page ${currentPage} (e.g., "Explain this formula", "Explain in Hinglish")...`
                : `Tell AI how to change your notes (e.g., "Make Definitions shorter", "Add 5-mark answer")...`
            }
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:opacity-50"
          />

          {isAiGenerating ? (
            <button
              type="button"
              onClick={stopAiGeneration}
              title="Stop AI Generation"
              className="h-9 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputPrompt.trim() || !activeSession}
              title="Send (Enter)"
              className={`h-9 px-3.5 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-40 ${
                aiMode === 'change_notes'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              {aiMode === 'change_notes' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Update</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-0.5">
          <span>Enter to send · Shift+Enter for new line</span>
          <span className="font-mono tabular-nums">
            {aiMode === 'ask' ? 'Mode A: Ask / Explain' : 'Mode B: Change Notes'}
          </span>
        </div>
      </form>
    </section>
  );
};
