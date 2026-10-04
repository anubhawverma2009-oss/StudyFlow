import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DocumentMetadata, PDFPageData, SubjectType } from '../../types/workspace';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };

export interface PDFValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function validatePdfFile(file: File): PDFValidationResult {
  if (!file) {
    return { valid: false, error: 'No file was provided.' };
  }

  const isPdfMime = file.type === 'application/pdf';
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
  if (!isPdfMime && !isPdfExt) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload a valid PDF document (.pdf).'
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected PDF file is empty (0 bytes).'
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'This PDF exceeds the 50 MB size limit. Please upload a smaller document or chapter.'
    };
  }

  return { valid: true };
}

function detectSubjectType(fullText: string): SubjectType {
  const sample = fullText.slice(0, 15000).toLowerCase();
  const mathHits = (
    sample.match(
      /\b(integral|derivative|theorem|calculus|matrix|eigenvalue|equation|ode|lemma|proof|differential|vector|limit)\b/g
    ) || []
  ).length;
  const progHits = (
    sample.match(
      /\b(function|algorithm|complexity|python|javascript|array|hash|tree|graph|pointer|compiler|runtime|class|object)\b/g
    ) || []
  ).length;
  const theoryHits = (
    sample.match(
      /\b(architecture|chapter|concept|system|process|memory|history|definition|principle|model|organization)\b/g
    ) || []
  ).length;

  if (mathHits > progHits && mathHits > theoryHits && mathHits >= 3) return 'mathematics';
  if (progHits > mathHits && progHits >= 4) return 'programming';
  if (theoryHits >= 2) return 'theory';
  return 'general';
}

function extractHeadingsAndFormulas(lines: string[]): {
  headings: string[];
  formulas: string[];
  hasTables: boolean;
} {
  const headings: string[] = [];
  const formulas: string[] = [];
  let hasTables = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (
      line.length >= 4 &&
      line.length <= 90 &&
      (/^(chapter|section|unit|\d+\.\d*)\b/i.test(line) ||
        (line === line.toUpperCase() && /[A-Z]{3,}/.test(line) && line.split(/\s+/).length <= 10))
    ) {
      if (!headings.includes(line) && headings.length < 6) {
        headings.push(line);
      }
    }

    if (
      line.length >= 5 &&
      line.length <= 140 &&
      (/[=≈≠≤≥±∑∏∫√∞]/.test(line) || /\bO\([n1log\s^2!]+\)/.test(line) || /\b(d\/dx|dy\/dx)\b/.test(line))
    ) {
      if (!formulas.includes(line) && formulas.length < 6) {
        formulas.push(line);
      }
    }

    if (line.includes(' | ') || /\s{4,}\S+\s{4,}\S+/.test(line)) {
      hasTables = true;
    }
  }

  return { headings, formulas, hasTables };
}

export async function processPdfBuffer(
  buffer: Uint8Array,
  fileName: string,
  fileSize: number,
  onProgress?: (current: number, total: number) => void
): Promise<{
  metadata: DocumentMetadata;
  pdfDocument: pdfjsLib.PDFDocumentProxy;
}> {
  const bufferCopy = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: bufferCopy
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  if (numPages === 0) {
    throw new Error('This PDF contains 0 pages.');
  }

  const pages: PDFPageData[] = [];
  let totalWords = 0;
  const maxPagesToIndexImmediately = Math.min(numPages, 80);

  for (let pageNum = 1; pageNum <= maxPagesToIndexImmediately; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, maxPagesToIndexImmediately);
    }

    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();

    let lastY: number | null = null;
    const lineChunks: string[] = [];
    let currentLine = '';

    for (const item of textContent.items as any[]) {
      if (typeof item.str !== 'string') continue;
      const y = item.transform ? Math.round(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) {
          lineChunks.push(currentLine.trim());
        }
        currentLine = item.str;
      } else {
        currentLine += (currentLine && !currentLine.endsWith(' ') ? ' ' : '') + item.str;
      }
      lastY = y;
    }
    if (currentLine.trim()) {
      lineChunks.push(currentLine.trim());
    }

    const pageText = lineChunks.join('\n');
    const words = pageText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    totalWords += words;

    const { headings, formulas, hasTables } = extractHeadingsAndFormulas(lineChunks);

    pages.push({
      pageNumber: pageNum,
      text: pageText,
      headings: headings.length > 0 ? headings : [`Page ${pageNum}`],
      formulas,
      hasTables,
      wordCount: words
    });
  }

  const isScanned = totalWords < Math.max(15, maxPagesToIndexImmediately * 6);
  const combinedText = pages.map((p) => p.text).join('\n\n');
  const subjectType = detectSubjectType(combinedText);

  const cleanTitle = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  const keyTopics = pages
    .flatMap((p) => p.headings)
    .filter((h) => !/^Page \d+$/i.test(h))
    .slice(0, 8);

  const metadata: DocumentMetadata = {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle || 'Uploaded Study Document',
    fileName,
    fileSize,
    pageCount: numPages,
    uploadedAt: new Date().toISOString(),
    isScanned,
    subjectType,
    pages,
    keyTopics: keyTopics.length > 0 ? keyTopics : [`${cleanTitle} Overview`]
  };

  return { metadata, pdfDocument };
}

export function retrieveRelevantDocumentContext(
  document: DocumentMetadata,
  currentPage: number,
  userQuery: string,
  selectedText?: string,
  maxPagesToInclude = 4
): {
  contextText: string;
  includedPages: number[];
} {
  if (!document || !document.pages || document.pages.length === 0) {
    return { contextText: '', includedPages: [] };
  }

  const targetPageNumbers = new Set<number>();

  const explicitMatches = userQuery.matchAll(/\bpages?\s*(\d+)(?:\s*(?:to|-|and|,)\s*(\d+))?/gi);
  for (const match of explicitMatches) {
    const p1 = parseInt(match[1], 10);
    if (p1 >= 1 && p1 <= document.pageCount) {
      targetPageNumbers.add(p1);
    }
    if (match[2]) {
      const p2 = parseInt(match[2], 10);
      if (p2 >= p1 && p2 <= document.pageCount) {
        for (let p = p1; p <= Math.min(p2, p1 + 4); p++) {
          targetPageNumbers.add(p);
        }
      }
    }
  }

  if (currentPage >= 1 && currentPage <= document.pages.length) {
    targetPageNumbers.add(currentPage);
  }

  const queryTerms = userQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['explain', 'what', 'this', 'that', 'page', 'notes', 'make', 'the', 'for', 'and', 'with'].includes(w));

  if (queryTerms.length > 0 && targetPageNumbers.size < maxPagesToInclude) {
    const scored = document.pages
      .map((p) => {
        const lower = p.text.toLowerCase();
        let score = 0;
        for (const term of queryTerms) {
          if (lower.includes(term)) {
            score += 2;
          }
          if (p.headings.some((h) => h.toLowerCase().includes(term))) {
            score += 4;
          }
        }
        return { pageNumber: p.pageNumber, score };
      })
      .filter((s) => s.score > 0 && !targetPageNumbers.has(s.pageNumber))
      .sort((a, b) => b.score - a.score);

    for (const item of scored) {
      if (targetPageNumbers.size >= maxPagesToInclude) break;
      targetPageNumbers.add(item.pageNumber);
    }
  }

  if (
    targetPageNumbers.size < maxPagesToInclude &&
    /\b(chapter|entire|all|summary|summarize|generate|overview|exam|questions)\b/i.test(userQuery)
  ) {
    for (const p of document.pages) {
      if (targetPageNumbers.size >= Math.min(6, document.pages.length)) break;
      targetPageNumbers.add(p.pageNumber);
    }
  }

  const sortedPages = Array.from(targetPageNumbers).sort((a, b) => a - b);
  const pageBlocks = sortedPages
    .map((pageNum) => {
      const pageObj = document.pages.find((p) => p.pageNumber === pageNum);
      if (!pageObj) return '';
      const textSnippet = pageObj.text.slice(0, 3200);
      return `--- [PDF PAGE ${pageObj.pageNumber}] ---\nHeadings: ${pageObj.headings.join(' | ')}\n${textSnippet}`;
    })
    .filter(Boolean);

  let contextText = `Document Title: "${document.title}" (Total Pages: ${document.pageCount}, Subject: ${document.subjectType})\nCurrently Viewed Page: Page ${currentPage}\n`;

  if (selectedText && selectedText.trim()) {
    contextText += `\nUSER SELECTED TEXT ON PAGE ${currentPage}:\n"""\n${selectedText.trim()}\n"""\n`;
  }

  contextText += `\nEXTRACTED PDF CONTENT:\n${pageBlocks.join('\n\n')}`;

  return {
    contextText,
    includedPages: sortedPages
  };
}
