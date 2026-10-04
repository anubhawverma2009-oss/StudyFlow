import {
  NoteBlock,
  NoteBlockType,
  NoteModificationPayload,
  NoteOperationType,
  NotesDocument,
  NoteSection,
  NoteSectionCategory,
} from '../../types/workspace';

const VALID_OPERATIONS: NoteOperationType[] = [
  'replace_all',
  'update_section',
  'insert_section',
  'append_to_section',
  'remove_section'
];

const VALID_BLOCK_TYPES: NoteBlockType[] = [
  'paragraph',
  'bullet_list',
  'numbered_list',
  'definition',
  'formula',
  'example',
  'callout',
  'table',
  'code',
  'exam_tip'
];

const VALID_CATEGORIES: NoteSectionCategory[] = [
  'overview',
  'concepts',
  'definitions',
  'formulas',
  'examples',
  'important',
  'revision',
  'exam_qa',
  'custom'
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeBlock(raw: any): NoteBlock | null {
  if (!raw || typeof raw !== 'object') return null;

  const type: NoteBlockType = VALID_BLOCK_TYPES.includes(raw.type)
    ? raw.type
    : 'paragraph';

  const content = typeof raw.content === 'string' ? raw.content.trim() : '';
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : undefined;

  let items: string[] | undefined;
  if (Array.isArray(raw.items)) {
    items = raw.items
      .map((i: any) => (typeof i === 'string' ? i.trim() : String(i)))
      .filter(Boolean);
  }

  let tableData: { headers: string[]; rows: string[][] } | undefined;
  if (raw.tableData && typeof raw.tableData === 'object') {
    const headers = Array.isArray(raw.tableData.headers)
      ? raw.tableData.headers.map((h: any) => String(h))
      : [];
    const rows = Array.isArray(raw.tableData.rows)
      ? raw.tableData.rows.map((r: any) =>
          Array.isArray(r) ? r.map((c: any) => String(c)) : []
        )
      : [];
    if (headers.length > 0) {
      tableData = { headers, rows };
    }
  }

  if (!content && (!items || items.length === 0) && !tableData) {
    return null;
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('blk'),
    type,
    title,
    content,
    items,
    tableData,
    pageRef: typeof raw.pageRef === 'number' ? raw.pageRef : undefined
  };
}

export function normalizeSection(raw: any): NoteSection | null {
  if (!raw || typeof raw !== 'object') return null;
  const heading = typeof raw.heading === 'string' ? raw.heading.trim() : '';
  if (!heading) return null;

  const category: NoteSectionCategory = VALID_CATEGORIES.includes(raw.category)
    ? raw.category
    : 'custom';

  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks = rawBlocks
    .map((b: any) => normalizeBlock(b))
    .filter((b: NoteBlock | null): b is NoteBlock => b !== null);

  if (blocks.length === 0 && typeof raw.content === 'string' && raw.content.trim()) {
    blocks.push({
      id: makeId('blk'),
      type: 'paragraph',
      content: raw.content.trim()
    });
  }

  if (blocks.length === 0) return null;

  const pageRefs = Array.isArray(raw.pageRefs)
    ? raw.pageRefs.filter((p: any) => typeof p === 'number')
    : undefined;

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('sec'),
    heading,
    category,
    blocks,
    pageRefs
  };
}

export function validateNoteModification(payload: any): {
  valid: boolean;
  error?: string;
  normalized?: NoteModificationPayload;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'AI returned an empty or non-object modification payload.' };
  }

  const operation = payload.operation as NoteOperationType;
  if (!VALID_OPERATIONS.includes(operation)) {
    return {
      valid: false,
      error: `Invalid note operation "${String(operation)}". Expected one of: ${VALID_OPERATIONS.join(', ')}.`
    };
  }

  const summaryOfChanges =
    typeof payload.summaryOfChanges === 'string' && payload.summaryOfChanges.trim()
      ? payload.summaryOfChanges.trim()
      : 'Updated study notes based on your instruction.';

  const reason =
    typeof payload.reason === 'string' && payload.reason.trim()
      ? payload.reason.trim()
      : summaryOfChanges;

  const targetHeading =
    typeof payload.targetHeading === 'string' && payload.targetHeading.trim()
      ? payload.targetHeading.trim()
      : undefined;

  const normalizedSections = Array.isArray(payload.sections)
    ? payload.sections
        .map((s: any) => normalizeSection(s))
        .filter((s: NoteSection | null): s is NoteSection => s !== null)
    : undefined;

  const normalizedBlocks = Array.isArray(payload.blocksToAppend)
    ? payload.blocksToAppend
        .map((b: any) => normalizeBlock(b))
        .filter((b: NoteBlock | null): b is NoteBlock => b !== null)
    : undefined;

  if (operation === 'replace_all' && (!normalizedSections || normalizedSections.length === 0)) {
    return {
      valid: false,
      error: 'Operation "replace_all" requires at least one valid note section.'
    };
  }

  if (
    (operation === 'update_section' || operation === 'insert_section') &&
    (!normalizedSections || normalizedSections.length === 0)
  ) {
    return {
      valid: false,
      error: `Operation "${operation}" requires at least one valid section in "sections".`
    };
  }

  if (operation === 'append_to_section' && (!normalizedBlocks || normalizedBlocks.length === 0)) {
    if (normalizedSections && normalizedSections.length > 0 && normalizedSections[0].blocks.length > 0) {
      return {
        valid: true,
        normalized: {
          operation,
          targetHeading: targetHeading || normalizedSections[0].heading,
          summaryOfChanges,
          reason,
          updatedTitle: payload.updatedTitle,
          subjectType: payload.subjectType,
          blocksToAppend: normalizedSections[0].blocks
        }
      };
    }
    return {
      valid: false,
      error: 'Operation "append_to_section" requires valid blocks to append.'
    };
  }

  if (operation === 'remove_section' && !targetHeading) {
    return {
      valid: false,
      error: 'Operation "remove_section" requires a "targetHeading" specifying which section to remove.'
    };
  }

  return {
    valid: true,
    normalized: {
      operation,
      targetHeading,
      summaryOfChanges,
      reason,
      updatedTitle: typeof payload.updatedTitle === 'string' ? payload.updatedTitle.trim() : undefined,
      subjectType: payload.subjectType,
      sections: normalizedSections,
      blocksToAppend: normalizedBlocks
    }
  };
}

function findSectionIndex(sections: NoteSection[], targetHeading?: string): number {
  if (!targetHeading) return -1;
  const cleanTarget = targetHeading.toLowerCase().trim();
  const exactIdx = sections.findIndex((s) => s.heading.toLowerCase().trim() === cleanTarget);
  if (exactIdx !== -1) return exactIdx;

  return sections.findIndex(
    (s) =>
      s.heading.toLowerCase().includes(cleanTarget) ||
      cleanTarget.includes(s.heading.toLowerCase())
  );
}

export function applyNoteModification(
  currentNotes: NotesDocument,
  payload: NoteModificationPayload
): { updatedNotes: NotesDocument; targetSectionName: string } {
  const clonedSections: NoteSection[] = JSON.parse(JSON.stringify(currentNotes.sections));
  let nextSections = clonedSections;
  let targetSectionName = payload.targetHeading || 'All Sections';

  switch (payload.operation) {
    case 'replace_all': {
      nextSections = payload.sections || [];
      targetSectionName = 'Entire Notes Document';
      break;
    }

    case 'update_section': {
      const incoming = payload.sections || [];
      const idx = findSectionIndex(clonedSections, payload.targetHeading || incoming[0]?.heading);
      if (idx !== -1 && incoming.length > 0) {
        targetSectionName = clonedSections[idx].heading;
        nextSections = [
          ...clonedSections.slice(0, idx),
          ...incoming,
          ...clonedSections.slice(idx + 1)
        ];
      } else if (incoming.length > 0) {
        targetSectionName = incoming[0].heading;
        nextSections = [...clonedSections, ...incoming];
      }
      break;
    }

    case 'insert_section': {
      const incoming = payload.sections || [];
      if (incoming.length > 0) {
        const idx = findSectionIndex(clonedSections, payload.targetHeading);
        targetSectionName = incoming.map((s) => s.heading).join(', ');
        if (idx !== -1) {
          nextSections = [
            ...clonedSections.slice(0, idx + 1),
            ...incoming,
            ...clonedSections.slice(idx + 1)
          ];
        } else {
          nextSections = [...clonedSections, ...incoming];
        }
      }
      break;
    }

    case 'append_to_section': {
      const blocks = payload.blocksToAppend || [];
      const idx = findSectionIndex(clonedSections, payload.targetHeading);
      if (idx !== -1) {
        targetSectionName = clonedSections[idx].heading;
        clonedSections[idx] = {
          ...clonedSections[idx],
          blocks: [...clonedSections[idx].blocks, ...blocks]
        };
        nextSections = clonedSections;
      } else if (blocks.length > 0) {
        const newHeading = payload.targetHeading || 'Additional Study Notes';
        targetSectionName = newHeading;
        nextSections = [
          ...clonedSections,
          {
            id: makeId('sec'),
            heading: newHeading,
            category: 'custom',
            pageRefs: [1],
            blocks
          }
        ];
      }
      break;
    }

    case 'remove_section': {
      const idx = findSectionIndex(clonedSections, payload.targetHeading);
      if (idx !== -1 && clonedSections.length > 1) {
        targetSectionName = clonedSections[idx].heading;
        nextSections = [
          ...clonedSections.slice(0, idx),
          ...clonedSections.slice(idx + 1)
        ];
      }
      break;
    }
  }

  const updatedNotes: NotesDocument = {
    documentId: currentNotes.documentId,
    title: payload.updatedTitle || currentNotes.title,
    subjectType: payload.subjectType || currentNotes.subjectType,
    sections: nextSections,
    version: currentNotes.version + 1,
    updatedAt: new Date().toISOString()
  };

  return { updatedNotes, targetSectionName };
}

export function notesToMarkdown(notes: NotesDocument): string {
  const lines: string[] = [];
  lines.push(`# ${notes.title}`);
  lines.push('');

  for (const section of notes.sections) {
    const pageTag =
      section.pageRefs && section.pageRefs.length > 0
        ? ` *(Pages ${section.pageRefs.join(', ')})*`
        : '';
    lines.push(`## ${section.heading}${pageTag}`);
    lines.push('');

    for (const block of section.blocks) {
      switch (block.type) {
        case 'paragraph':
          if (block.title) {
            lines.push(`**${block.title}**`);
          }
          lines.push(block.content);
          lines.push('');
          break;

        case 'bullet_list':
          if (block.title) lines.push(`**${block.title}**`);
          if (block.content) lines.push(block.content);
          (block.items || []).forEach((item) => {
            lines.push(`- ${item}`);
          });
          lines.push('');
          break;

        case 'numbered_list':
          if (block.title) lines.push(`**${block.title}**`);
          if (block.content) lines.push(block.content);
          (block.items || []).forEach((item, idx) => {
            lines.push(`${idx + 1}. ${item}`);
          });
          lines.push('');
          break;

        case 'definition':
          lines.push(`> **Definition — ${block.title || 'Term'}:** ${block.content}`);
          lines.push('');
          break;

        case 'formula':
          if (block.title) lines.push(`**Formula (${block.title}):**`);
          lines.push('```math');
          lines.push(block.content);
          lines.push('```');
          lines.push('');
          break;

        case 'example':
          lines.push(`> **Example${block.title ? ` (${block.title})` : ''}:** ${block.content}`);
          lines.push('');
          break;

        case 'exam_tip':
          lines.push(`> **Exam Tip${block.title ? ` — ${block.title}` : ''}:** ${block.content}`);
          lines.push('');
          break;

        case 'callout':
          lines.push(`> **${block.title || 'Important Note'}:** ${block.content}`);
          lines.push('');
          break;

        case 'code':
          if (block.title) lines.push(`**${block.title}:**`);
          lines.push('```');
          lines.push(block.content);
          lines.push('```');
          lines.push('');
          break;

        case 'table':
          if (block.title) lines.push(`**${block.title}**`);
          if (block.tableData && block.tableData.headers.length > 0) {
            lines.push(`| ${block.tableData.headers.join(' | ')} |`);
            lines.push(`| ${block.tableData.headers.map(() => '---').join(' | ')} |`);
            block.tableData.rows.forEach((row) => {
              lines.push(`| ${row.join(' | ')} |`);
            });
          }
          lines.push('');
          break;
      }
    }
  }

  return lines.join('\n').trim();
}
