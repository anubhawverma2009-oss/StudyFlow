import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  FileUp,
  List,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  PanelLeftClose,
  PlusCircle,
  Search,
  Sparkles,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { pdfjsLib } from '../../services/pdf/pdfProcessor';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { SampleDocKey, SAMPLE_TEMPLATES } from '../../utils/sampleDocuments';

export const PDFPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const pdfBytes = useWorkspaceStore((s) => s.pdfBytes);
  const isProcessingPdf = useWorkspaceStore((s) => s.isProcessingPdf);
  const processingStatusText = useWorkspaceStore((s) => s.processingStatusText);
  const pdfError = useWorkspaceStore((s) => s.pdfError);
  const clearPdfError = useWorkspaceStore((s) => s.clearPdfError);
  const zoomScale = useWorkspaceStore((s) => s.zoomScale);
  const zoomMode = useWorkspaceStore((s) => s.zoomMode);
  const setZoomScale = useWorkspaceStore((s) => s.setZoomScale);
  const setZoomMode = useWorkspaceStore((s) => s.setZoomMode);
  const pdfSearchQuery = useWorkspaceStore((s) => s.pdfSearchQuery);
  const setPdfSearchQuery = useWorkspaceStore((s) => s.setPdfSearchQuery);
  const selectedPdfText = useWorkspaceStore((s) => s.selectedPdfText);
  const setSelectedPdfText = useWorkspaceStore((s) => s.setSelectedPdfText);
  const setCurrentPage = useWorkspaceStore((s) => s.setCurrentPage);
  const uploadPdfFile = useWorkspaceStore((s) => s.uploadPdfFile);
  const loadSampleDocument = useWorkspaceStore((s) => s.loadSampleDocument);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const addTextOrExplanationToNotes = useWorkspaceStore((s) => s.addTextOrExplanationToNotes);
  const setAiMode = useWorkspaceStore((s) => s.setAiMode);
  const fullscreenPanel = useWorkspaceStore((s) => s.fullscreenPanel);
  const setFullscreenPanel = useWorkspaceStore((s) => s.setFullscreenPanel);
  const updatePanelLayout = useWorkspaceStore((s) => s.updatePanelLayout);
  const setMobileActiveTab = useWorkspaceStore((s) => s.setMobileActiveTab);

  const activeSession = sessions[activeSessionId];
  const currentPage = activeSession?.currentPage || 1;
  const pageCount = activeSession?.document.pageCount || 1;

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [showSelectableTextLayer, setShowSelectableTextLayer] = useState(false);
  const [pageInputText, setPageInputText] = useState(String(currentPage));
  const [isRenderingCanvas, setIsRenderingCanvas] = useState(false);
  const [canvasRenderFailed, setCanvasRenderFailed] = useState(false);

  useEffect(() => {
    setPageInputText(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: any = null;

    async function renderPdfPage() {
      if (!pdfBytes || !canvasRef.current || !activeSession) {
        return;
      }

      setIsRenderingCanvas(true);
      setCanvasRenderFailed(false);

      try {
        const dataCopy = new Uint8Array(pdfBytes);
        const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        const safePage = Math.max(1, Math.min(currentPage, pdfDoc.numPages));
        const page = await pdfDoc.getPage(safePage);
        if (isCancelled) return;

        const baseViewport = page.getViewport({ scale: 1.0 });
        let effectiveScale = zoomScale;

        if (containerRef.current) {
          const containerWidth = Math.max(280, containerRef.current.clientWidth - 40);
          const containerHeight = Math.max(360, containerRef.current.clientHeight - 40);
          if (zoomMode === 'fit-width') {
            effectiveScale = containerWidth / baseViewport.width;
          } else if (zoomMode === 'fit-page') {
            effectiveScale = Math.min(
              containerWidth / baseViewport.width,
              containerHeight / baseViewport.height
            );
          }
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: effectiveScale * dpr });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas
        } as any);

        await renderTask.promise;
        if (!isCancelled) {
          setIsRenderingCanvas(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('PDF canvas render fallback activated:', err);
          setCanvasRenderFailed(true);
          setIsRenderingCanvas(false);
        }
      }
    }

    renderPdfPage();

    return () => {
      isCancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        renderTask.cancel();
      }
    };
  }, [pdfBytes, currentPage, zoomScale, zoomMode, fullscreenPanel, activeSession?.id]);

  const searchMatches = useMemo(() => {
    if (!activeSession || !pdfSearchQuery.trim()) return [];
    const q = pdfSearchQuery.trim().toLowerCase();
    return activeSession.document.pages
      .filter((p) => p.text.toLowerCase().includes(q))
      .map((p) => {
        const idx = p.text.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 35);
        const snippet = p.text.slice(start, idx + q.length + 55).replace(/\n+/g, ' ');
        return {
          pageNumber: p.pageNumber,
          snippet: (start > 0 ? '...' : '') + snippet + '...'
        };
      });
  }, [activeSession, pdfSearchQuery]);

  const currentPageData = useMemo(() => {
    if (!activeSession) return null;
    return (
      activeSession.document.pages.find((p) => p.pageNumber === currentPage) ||
      activeSession.document.pages[0] ||
      null
    );
  }, [activeSession, currentPage]);

  const handleTextSelectionMouseUp = () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text && text.length >= 3) {
      setSelectedPdfText(text, currentPage);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadPdfFile(file);
    }
  };

  const handleSendVisualSnapshotToAi = async () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      setAiMode('ask');
      setMobileActiveTab('chat');
      await sendMessage(
        `Analyze the visual snapshot of Page ${currentPage} and explain its contents, diagrams, or text.`,
        {
          forceMode: 'ask',
          pageImageBase64: dataUrl
        }
      );
    } catch {
      // Ignore
    }
  };

  const renderHighlightedText = (text: string) => {
    if (!pdfSearchQuery.trim()) return text;
    const escaped = pdfSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === pdfSearchQuery.trim().toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-slate-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <section
      aria-label="PDF Document Viewer"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className="flex flex-col h-full bg-slate-100/80 border-r border-slate-200 select-text relative overflow-hidden"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            await uploadPdfFile(f);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-blue-900/20 backdrop-blur-xs border-2 border-dashed border-blue-600 m-2 rounded-xl flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center mb-3 shadow-md">
            <FileUp className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Drop your PDF here to study</p>
          <p className="text-xs text-slate-600 mt-1">
            ScholarSync will immediately render pages and index content for AI Q&amp;A and notes
          </p>
        </div>
      )}

      <div className="h-11 bg-white border-b border-slate-200 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsOutlineOpen((v) => !v)}
            disabled={!activeSession}
            title="Toggle Page & Chapter Index"
            className={`p-1.5 rounded-md transition-colors ${
              isOutlineOpen
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            } disabled:opacity-40`}
          >
            <List className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={!activeSession || currentPage <= 1}
            title="Previous Page"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseInt(pageInputText, 10);
              if (!isNaN(parsed)) {
                setCurrentPage(parsed);
              }
            }}
            className="flex items-center gap-1 text-xs font-mono tabular-nums text-slate-700"
          >
            <input
              type="text"
              value={pageInputText}
              onChange={(e) => setPageInputText(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(pageInputText, 10);
                if (!isNaN(parsed)) setCurrentPage(parsed);
                else setPageInputText(String(currentPage));
              }}
              disabled={!activeSession}
              aria-label="Current page number"
              className="w-8 text-center py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono tabular-nums focus:outline-none focus:border-blue-600"
            />
            <span className="text-slate-400">/</span>
            <span>{pageCount}</span>
          </form>

          <button
            type="button"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!activeSession || currentPage >= pageCount}
            title="Next Page"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomScale(zoomScale - 0.15)}
            disabled={!activeSession}
            title="Zoom Out"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomMode(zoomMode === 'fit-width' ? 'fit-page' : 'fit-width')}
            disabled={!activeSession}
            title="Toggle Fit Width / Fit Page"
            className="px-2 py-1 rounded text-[11px] font-mono tabular-nums text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            {zoomMode === 'fit-width'
              ? 'Fit Width'
              : zoomMode === 'fit-page'
              ? 'Fit Page'
              : `${Math.round(zoomScale * 100)}%`}
          </button>

          <button
            type="button"
            onClick={() => setZoomScale(zoomScale + 0.15)}
            disabled={!activeSession}
            title="Zoom In"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSelectableTextLayer((v) => !v)}
            disabled={!activeSession}
            title="Toggle Selectable Text View for Highlighting Passages"
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
              showSelectableTextLayer
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            } disabled:opacity-40`}
          >
            <FileText className="w-3 h-3" />
            <span>{showSelectableTextLayer ? 'Canvas View' : 'Select Text'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen((v) => !v)}
            disabled={!activeSession}
            title="Search inside PDF"
            className={`p-1.5 rounded-md transition-colors ${
              isSearchOpen
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            } disabled:opacity-40`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setFullscreenPanel(fullscreenPanel === 'pdf' ? 'none' : 'pdf')
            }
            title={fullscreenPanel === 'pdf' ? 'Exit Fullscreen' : 'Fullscreen PDF'}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 hidden md:inline-flex"
          >
            {fullscreenPanel === 'pdf' ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {fullscreenPanel === 'none' && (
            <button
              type="button"
              onClick={() => updatePanelLayout({ isPdfCollapsed: true })}
              title="Collapse PDF Panel"
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 hidden lg:inline-flex"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isSearchOpen && activeSession && (
        <div className="bg-white border-b border-slate-200 p-2.5 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              value={pdfSearchQuery}
              onChange={(e) => setPdfSearchQuery(e.target.value)}
              placeholder="Search concept, formula, or term across all pages..."
              autoFocus
              className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-600"
            />
            {pdfSearchQuery && (
              <span className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
                {searchMatches.length} {searchMatches.length === 1 ? 'page' : 'pages'}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setPdfSearchQuery('');
              }}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {pdfSearchQuery.trim() && searchMatches.length > 0 && (
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md bg-slate-50/60">
              {searchMatches.map((m) => (
                <button
                  key={m.pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(m.pageNumber)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50/70 flex items-start gap-2 transition-colors ${
                    m.pageNumber === currentPage ? 'bg-blue-50/90 font-medium' : ''
                  }`}
                >
                  <span className="font-mono tabular-nums text-[11px] text-blue-700 shrink-0 mt-0.5">
                    Page {m.pageNumber}
                  </span>
                  <span className="text-slate-600 line-clamp-1">{m.snippet}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOutlineOpen && activeSession && (
        <div className="bg-white border-b border-slate-200 max-h-48 overflow-y-auto p-2.5 shrink-0">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Document Page Index ({activeSession.document.pageCount} pages)
            </span>
            <button
              type="button"
              onClick={() => setIsOutlineOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="space-y-1">
            {activeSession.document.pages.map((p) => (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => {
                  setCurrentPage(p.pageNumber);
                  setIsOutlineOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 transition-colors ${
                  p.pageNumber === currentPage
                    ? 'bg-blue-50 text-blue-800 font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{p.headings[0] || `Page ${p.pageNumber}`}</span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                  p. {p.pageNumber}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSession?.document.isScanned && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              This PDF appears to be image-based. Text extraction may be limited.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSendVisualSnapshotToAi}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-medium whitespace-nowrap inline-flex items-center gap-1 shrink-0"
          >
            <Camera className="w-3 h-3" />
            <span>Analyze Page Image</span>
          </button>
        </div>
      )}

      {pdfError && (
        <div className="bg-red-50 border-b border-red-200 px-3.5 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{pdfError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-medium whitespace-nowrap"
            >
              Retry Upload
            </button>
            <button
              type="button"
              onClick={clearPdfError}
              className="text-red-500 hover:text-red-800 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {selectedPdfText && (
        <div className="bg-slate-900 text-white px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          <div className="text-[11px] text-slate-300 truncate max-w-[200px]">
            Selected: <span className="text-white italic">"{selectedPdfText}"</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAiMode('ask');
                setMobileActiveTab('chat');
                sendMessage(
                  `Explain this selected passage from Page ${currentPage} in simple terms with an example:\n\n"${selectedPdfText}"`,
                  { forceMode: 'ask', quickAction: 'explain' }
                );
              }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3" />
              <span>Explain</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAiMode('ask');
                setMobileActiveTab('chat');
                sendMessage(
                  `Summarize this selected passage from Page ${currentPage} concisely:\n\n"${selectedPdfText}"`,
                  { forceMode: 'ask', quickAction: 'summarize' }
                );
              }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-[11px] font-medium whitespace-nowrap"
            >
              Summarize
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileActiveTab('notes');
                addTextOrExplanationToNotes(selectedPdfText, `selected passage from Page ${currentPage}`);
              }}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
            >
              <PlusCircle className="w-3 h-3" />
              <span>Add to Notes</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPdfText('')}
              title="Clear Selection"
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        onMouseUp={handleTextSelectionMouseUp}
        className="flex-1 overflow-auto p-4 flex flex-col items-center justify-start relative"
      >
        {isProcessingPdf ? (
          <div className="my-auto max-w-sm w-full bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">
              {processingStatusText || 'Reading your PDF...'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Extracting headings, formulas, and page references for AI study context.
            </p>
          </div>
        ) : !activeSession ? (
          <div className="my-auto max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs">
            <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-5 h-5" />
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Upload a PDF to start studying.
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Drop any lecture slide deck, textbook chapter, or research paper here to begin your study session.
            </p>

            <div className="mt-5 text-left bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] font-semibold text-blue-700">01.</span>
                <span>Upload your PDF document or open a sample chapter</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] font-semibold text-blue-700">02.</span>
                <span>Ask the AI Tutor anything grounded in the current page</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] font-semibold text-blue-700">03.</span>
                <span>Generate, surgically refine, and export structured notes</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Choose PDF from Computer</span>
            </button>

            <div className="mt-4 pt-4 border-t border-slate-100 text-left">
              <p className="text-[11px] font-medium text-slate-400 mb-2">
                Or launch a sample academic textbook chapter:
              </p>
              <div className="space-y-1.5">
                {(Object.keys(SAMPLE_TEMPLATES) as SampleDocKey[]).map((key) => {
                  const tmpl = SAMPLE_TEMPLATES[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => loadSampleDocument(key)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-slate-800 truncate">{tmpl.title}</span>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {tmpl.pages.length}p
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div
              className={`bg-white border border-slate-300/90 shadow-sm rounded-sm overflow-hidden relative transition-opacity ${
                showSelectableTextLayer || canvasRenderFailed ? 'hidden' : 'block'
              }`}
            >
              {isRenderingCanvas && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              )}
              <canvas ref={canvasRef} className="block max-w-full h-auto" />
            </div>

            {(showSelectableTextLayer || canvasRenderFailed) && currentPageData && (
              <div className="w-full max-w-[680px] bg-white border border-slate-200 shadow-xs rounded-lg p-6 md:p-8 text-slate-800">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 text-[11px] text-slate-400 font-mono tabular-nums">
                  <span className="truncate uppercase">{activeSession.document.title}</span>
                  <span>
                    PAGE {currentPageData.pageNumber} OF {activeSession.document.pageCount}
                  </span>
                </div>

                <div className="mb-3 bg-blue-50/70 border border-blue-100 rounded-md px-3 py-2 text-xs text-blue-900 flex items-center justify-between gap-2">
                  <span>
                    Highlight any sentence or formula below to <strong>Explain</strong>,{' '}
                    <strong>Summarize</strong>, or <strong>Add to Notes</strong>.
                  </span>
                  {!canvasRenderFailed && (
                    <button
                      type="button"
                      onClick={() => setShowSelectableTextLayer(false)}
                      className="text-[11px] font-medium text-blue-700 hover:underline shrink-0"
                    >
                      Back to PDF Canvas
                    </button>
                  )}
                </div>

                <div className="space-y-3.5 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {renderHighlightedText(currentPageData.text)}
                </div>
              </div>
            )}

            {currentPageData && (
              <div className="mt-3 w-full max-w-[640px] bg-white border border-slate-200 rounded-lg px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-medium text-slate-800 truncate">
                    {currentPageData.headings[0] || `Page ${currentPage}`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {currentPageData.wordCount} words
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAiMode('ask');
                      setMobileActiveTab('chat');
                      sendMessage(`Explain Page ${currentPage} in simple terms with an example.`, {
                        forceMode: 'ask',
                        quickAction: 'explain'
                      });
                    }}
                    className="text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Explain Page {currentPage}</span>
                  </button>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSelectableTextLayer((v) => !v)}
                    className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{showSelectableTextLayer ? 'PDF View' : 'Select Text'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
