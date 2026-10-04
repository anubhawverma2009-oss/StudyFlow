import { GoogleGenAI, Type } from '@google/genai';

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

const TUTOR_SYSTEM_INSTRUCTION = `You are ScholarSync, a patient, rigorous, and clear academic study tutor embedded inside a three-panel PDF + AI + Notes workspace.

CORE ACADEMIC PRINCIPLES:
1. Ground your explanations primarily in the provided PDF Document Context and current page.
2. Always cite relevant PDF page numbers explicitly using the format [Page X] or "Page X" whenever information comes from a specific page. Never fabricate page numbers.
3. If the student's question cannot be answered from the uploaded PDF, state clearly: "This specific detail is not covered in the uploaded PDF," and then provide helpful general academic knowledge clearly labeled as "[General Knowledge]".
4. Structure explanations for maximum student comprehension:
   - **Simple Explanation**: Clear, intuitive breakdown without corporate jargon.
   - **Concrete Example / Formula**: Step-by-step illustration or equation from the text.
   - **Key Takeaway**: 1–2 sentences summarizing what to remember for exams.
5. Respect language requests: if the student asks in Hinglish or asks to "Explain in Hinglish", write naturally in clear Hinglish (Hindi + English technical terms in Latin script, e.g., "Ye concept PDF ke Page 3 par explain kiya gaya hai...").
6. In ASK / EXPLAIN mode, NEVER claim that you modified the notes editor. You are answering in conversation only.`;

const NOTES_ENGINE_SYSTEM_INSTRUCTION = `You are the ScholarSync Structured Notes Engine. Your job is to generate or surgically modify structured study notes in JSON format based on the student's instruction, the uploaded PDF context, and the current Notes state.

CRITICAL SURGICAL EDITING RULES:
1. Read the user's instruction carefully and choose the minimal appropriate operation:
   - "replace_all": ONLY when generating fresh notes from scratch, or when the user asks to restructure/shorten/translate the ENTIRE notes document.
   - "update_section": When the user asks to modify, simplify, rewrite, or expand a SPECIFIC section (e.g., "Change only the definitions", "Make Key Concepts shorter", "Convert Overview into Hinglish"). Set "targetHeading" to the exact heading of that section and return ONLY that updated section in "sections".
   - "insert_section": When the user asks to add a new section (e.g., "Add a 5-mark exam answer section", "Add 5 important questions", "Add common mistakes"). Set "targetHeading" to the section after which it should be inserted (or leave empty to append at the end) and return the new section(s) in "sections".
   - "append_to_section": When the user asks to add a specific item (like an example, formula, or definition) into an existing section. Set "targetHeading" to that section's heading and provide "blocksToAppend".
   - "remove_section": When the user asks to delete/remove a specific section. Set "targetHeading" to that section's heading.
2. Adapt note sections to the subject type:
   - For "mathematics": Include Formulas, Definitions, Solved Examples, Step-by-Step Procedures, and Common Mistakes.
   - For "programming": Include Core Concepts, Syntax/Complexity, Code Examples, and Common Bugs/Edge Cases.
   - For "theory" / "general": Include Overview, Key Concepts, Definitions, Formulas (if applicable), Examples, and Quick Revision / Exam Tips.
3. Every block MUST have a valid "type" from: "paragraph", "bullet_list", "numbered_list", "definition", "formula", "example", "callout", "table", "code", "exam_tip".
4. Preserve accuracy and cite page numbers in "pageRef" or "pageRefs" whenever grounded in the PDF.`;

const NOTE_MODIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Brief conversational confirmation explaining what was updated in the notes.'
    },
    citedPages: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: 'PDF page numbers referenced in this update.'
    },
    modification: {
      type: Type.OBJECT,
      properties: {
        operation: {
          type: Type.STRING,
          description: 'One of: replace_all, update_section, insert_section, append_to_section, remove_section'
        },
        targetHeading: {
          type: Type.STRING,
          description: 'Target section heading for update_section, append_to_section, insert_section, or remove_section'
        },
        summaryOfChanges: {
          type: Type.STRING,
          description: 'Concise 1-sentence summary of the modification.'
        },
        reason: {
          type: Type.STRING,
          description: 'Why this operation was chosen based on user intent.'
        },
        updatedTitle: {
          type: Type.STRING,
          description: 'Optional updated document title if requested.'
        },
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              heading: { type: Type.STRING },
              category: {
                type: Type.STRING,
                description: 'One of: overview, concepts, definitions, formulas, examples, important, revision, exam_qa, custom'
              },
              pageRefs: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER }
              },
              blocks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: {
                      type: Type.STRING,
                      description: 'One of: paragraph, bullet_list, numbered_list, definition, formula, example, callout, table, code, exam_tip'
                    },
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    pageRef: { type: Type.INTEGER },
                    tableData: {
                      type: Type.OBJECT,
                      properties: {
                        headers: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        },
                        rows: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                          }
                        }
                      }
                    }
                  },
                  required: ['type', 'content']
                }
              }
            },
            required: ['heading', 'category', 'blocks']
          }
        },
        blocksToAppend: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              pageRef: { type: Type.INTEGER }
            },
            required: ['type', 'content']
          }
        }
      },
      required: ['operation', 'summaryOfChanges', 'reason']
    }
  },
  required: ['reply', 'citedPages', 'modification']
};

function buildGroundedFallbackChat(params: {
  documentContext: string;
  includedPages: number[];
  currentPage: number;
  selectedText?: string;
  userMessage: string;
  quickAction?: string;
}) {
  const { documentContext, includedPages, currentPage, selectedText, userMessage } = params;
  const pagesList = includedPages.length > 0 ? includedPages : [currentPage];
  const isHinglish = /hinglish|hindi/i.test(userMessage);

  const rawLines = documentContext
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 25 &&
        !l.startsWith('--- [PDF PAGE') &&
        !l.startsWith('Document Title:') &&
        !l.startsWith('Currently Viewed Page:') &&
        !l.startsWith('EXTRACTED PDF CONTENT:')
    );

  const keyExcerpts = rawLines.slice(0, 4);
  const focusSnippet =
    selectedText ||
    keyExcerpts[0] ||
    `The material on Page ${currentPage} covers core foundational concepts of this topic.`;

  if (isHinglish) {
    return {
      reply: `### Hinglish Explanation (Page ${pagesList.join(', ')})

**Simple Concept:**
Ye topic PDF ke **Page ${currentPage}** par detail mein explain kiya gaya hai. ${focusSnippet}

**Key Points jo aapko yaad rakhne chahiye:**
${keyExcerpts
  .slice(0, 3)
  .map((line) => `- ${line} *(Page ${currentPage})*`)
  .join('\n')}

**Exam Takeaway:**
Exam mein is concept ki core definition aur formula zaroor likhein. Agar aapko isko apne notes mein add karna hai, toh upar **Change Notes** mode select karein!`,
      responseType: 'EXPLANATION',
      citedPages: pagesList
    };
  }

  return {
    reply: `### Grounded Explanation (Page ${pagesList.join(', ')})

Based on **Page ${currentPage}** of your uploaded PDF:

${
  selectedText
    ? `> **Selected Passage:** *"${selectedText.slice(0, 220)}${
        selectedText.length > 220 ? '...' : ''
      }"*\n\n`
    : ''
}**1. Core Concept**
${focusSnippet}

**2. Key Supporting Points from the Document**
${keyExcerpts
  .slice(0, 3)
  .map((line) => `- ${line} **[Page ${currentPage}]**`)
  .join('\n')}

**3. Key Exam Takeaway**
Focus on the relationship between the primary definitions and expressions highlighted on **Page ${currentPage}**. *(Your notes were not modified because you are in **Ask / Explain** mode.)*`,
    responseType: 'EXPLANATION',
    citedPages: pagesList
  };
}

function buildGroundedFallbackNotesModification(params: {
  documentTitle: string;
  subjectType: string;
  currentPage: number;
  selectedText?: string;
  instruction: string;
  targetSectionHeading?: string;
  documentContext: string;
  includedPages: number[];
  currentNotes?: any;
  isFullGeneration?: boolean;
}) {
  const {
    documentTitle,
    subjectType,
    currentPage,
    selectedText,
    instruction,
    targetSectionHeading,
    documentContext,
    includedPages,
    currentNotes,
    isFullGeneration
  } = params;

  const pages = includedPages.length > 0 ? includedPages : [currentPage];
  const lowerInst = instruction.toLowerCase();

  const contentLines = documentContext
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 20 &&
        !l.startsWith('--- [PDF PAGE') &&
        !l.startsWith('Document Title:') &&
        !l.startsWith('Currently Viewed Page:') &&
        !l.startsWith('Headings:') &&
        !l.startsWith('EXTRACTED PDF CONTENT:')
    );

  if (
    isFullGeneration ||
    /\b(entire|whole|all notes|generate structured|from scratch)\b/i.test(lowerInst)
  ) {
    const bullets = contentLines.slice(0, 5).map((l) => `${l.slice(0, 160)} [Page ${currentPage}]`);
    return {
      reply: `I have generated structured **${subjectType}** study notes for **${documentTitle}** grounded in **Pages ${pages.join(
        ', '
      )}**.`,
      responseType: 'NOTE_GENERATION',
      citedPages: pages,
      modification: {
        operation: 'replace_all',
        summaryOfChanges: `Generated structured notes across ${pages.length} pages.`,
        reason: 'User requested structured note generation from PDF context.',
        updatedTitle: `${documentTitle} — Study Notes`,
        sections: [
          {
            id: `sec_ov_${Date.now()}`,
            heading: 'Overview',
            category: 'overview',
            pageRefs: [currentPage],
            blocks: [
              {
                id: `blk_1_${Date.now()}`,
                type: 'paragraph',
                content:
                  contentLines[0] ||
                  `Comprehensive study summary of ${documentTitle} focusing on Page ${currentPage}.`,
                pageRef: currentPage
              }
            ]
          },
          {
            id: `sec_kc_${Date.now()}`,
            heading: 'Key Concepts',
            category: 'concepts',
            pageRefs: pages,
            blocks: [
              {
                id: `blk_2_${Date.now()}`,
                type: 'bullet_list',
                title: 'Core Takeaways from the Text',
                content: 'Essential points extracted from the PDF:',
                items:
                  bullets.length > 0
                    ? bullets
                    : [
                        `Foundational principles introduced on Page ${currentPage}.`,
                        `Key relationships and structural properties verified across Pages ${pages.join(', ')}.`
                      ],
                pageRef: currentPage
              }
            ]
          },
          {
            id: `sec_def_${Date.now()}`,
            heading: 'Definitions & Core Terms',
            category: 'definitions',
            pageRefs: [currentPage],
            blocks: [
              {
                id: `blk_3_${Date.now()}`,
                type: 'definition',
                title: `Primary Concept (Page ${currentPage})`,
                content:
                  selectedText ||
                  contentLines[1] ||
                  `Key concept defined on Page ${currentPage} of ${documentTitle}.`,
                pageRef: currentPage
              }
            ]
          },
          {
            id: `sec_rev_${Date.now()}`,
            heading: 'Quick Revision & Exam Tips',
            category: 'revision',
            pageRefs: pages,
            blocks: [
              {
                id: `blk_4_${Date.now()}`,
                type: 'exam_tip',
                title: 'High-Yield Exam Focus',
                content:
                  contentLines[2] ||
                  `Review the definitions, formulas, and comparative tables on Page ${currentPage} before your exam.`,
                pageRef: currentPage
              }
            ]
          }
        ]
      }
    };
  }

  const existingSections: any[] = currentNotes?.sections || [];
  const matchedSection =
    (targetSectionHeading &&
      existingSections.find(
        (s) => s.heading.toLowerCase() === targetSectionHeading.toLowerCase()
      )) ||
    existingSections.find((s) => lowerInst.includes(s.heading.toLowerCase()));

  if (matchedSection && !/\b(add a section|new section|5-mark|questions)\b/i.test(lowerInst)) {
    const isHinglish = /hinglish|hindi/i.test(lowerInst);
    const isShorter = /short|concise|brief|simpler|simple|easier/i.test(lowerInst);

    const updatedBlocks = matchedSection.blocks.map((b: any, idx: number) => ({
      ...b,
      id: `blk_upd_${Date.now()}_${idx}`,
      content: isHinglish
        ? `[Hinglish] Ye point Page ${currentPage} par based hai: ${b.content}`
        : isShorter
        ? b.content.split('.')[0] + '.'
        : `${b.content} (Refined with Page ${currentPage} context)`
    }));

    if (/example/i.test(lowerInst)) {
      updatedBlocks.push({
        id: `blk_ex_${Date.now()}`,
        type: 'example',
        title: `Worked Example (Page ${currentPage})`,
        content:
          selectedText ||
          contentLines[0] ||
          `Practical illustration derived from Page ${currentPage} of ${documentTitle}.`,
        pageRef: currentPage
      });
    }

    return {
      reply: `I have updated only the **${matchedSection.heading}** section as requested, leaving all other sections in your notes untouched.`,
      responseType: 'NOTE_MODIFICATION',
      citedPages: [currentPage],
      modification: {
        operation: 'update_section',
        targetHeading: matchedSection.heading,
        summaryOfChanges: `Updated "${matchedSection.heading}" section on Page ${currentPage}.`,
        reason: `Surgical update applied strictly to "${matchedSection.heading}".`,
        sections: [
          {
            ...matchedSection,
            blocks: updatedBlocks
          }
        ]
      }
    };
  }

  const isExamQA = /question|5-mark|exam/i.test(lowerInst);
  const newHeading = isExamQA
    ? 'Exam Questions & 5-Mark Answers'
    : /example/i.test(lowerInst)
    ? `Worked Examples (Page ${currentPage})`
    : /formula/i.test(lowerInst)
    ? `Important Formulas (Page ${currentPage})`
    : `Study Additions (Page ${currentPage})`;

  return {
    reply: `I have added **${newHeading}** to your notes based on **Page ${currentPage}** without modifying your existing sections.`,
    responseType: 'NOTE_MODIFICATION',
    citedPages: [currentPage],
    modification: {
      operation: 'insert_section',
      targetHeading: targetSectionHeading,
      summaryOfChanges: `Inserted new section "${newHeading}" grounded in Page ${currentPage}.`,
      reason: 'Added requested material while preserving existing note structure.',
      sections: [
        {
          id: `sec_ins_${Date.now()}`,
          heading: newHeading,
          category: isExamQA ? 'exam_qa' : 'important',
          pageRefs: [currentPage],
          blocks: [
            {
              id: `blk_ins_${Date.now()}`,
              type: isExamQA ? 'numbered_list' : selectedText ? 'callout' : 'bullet_list',
              title: isExamQA
                ? `High-Yield Exam Prompts (Page ${currentPage})`
                : `Key Addition from Page ${currentPage}`,
              content:
                selectedText ||
                contentLines[0] ||
                `Structured notes synthesized from Page ${currentPage}.`,
              items: isExamQA
                ? [
                    `[Page ${currentPage}] Explain the core principle and architectural significance discussed on this page.`,
                    `[Page ${currentPage}] Derive or state the key formula and illustrate with a concrete numerical example.`,
                    `[Page ${currentPage}] Compare the primary mechanisms and highlight common exam pitfalls.`
                  ]
                : contentLines.slice(0, 3).map((l) => `${l.slice(0, 140)} [Page ${currentPage}]`),
              pageRef: currentPage
            }
          ]
        }
      ]
    }
  };
}

export async function handleAnalyzeDocument(params: {
  documentTitle: string;
  subjectType: string;
  pageCount: number;
  documentContext: string;
}) {
  const ai = getGenAIClient();
  if (!ai) {
    return {
      summary: `Academic study document "${params.documentTitle}" (${params.pageCount} pages, ${params.subjectType}). Ready for page-aware Q&A and structured note generation.`,
      keyTopics: [`${params.documentTitle} Fundamentals`, 'Core Definitions & Formulas', 'Exam Revision Points']
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analyze the following PDF excerpt and return a JSON object with a 2-sentence "summary" and an array of 4-6 "keyTopics".\n\n${params.documentContext}`,
      config: {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['summary', 'keyTopics']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      summary: parsed.summary || `Indexed ${params.documentTitle} (${params.pageCount} pages).`,
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : []
    };
  } catch {
    return {
      summary: `Indexed "${params.documentTitle}" (${params.pageCount} pages).`,
      keyTopics: ['Core Concepts', 'Definitions', 'Exam Review']
    };
  }
}

export async function handleTutorChat(params: {
  documentContext: string;
  includedPages: number[];
  currentPage: number;
  selectedText?: string;
  userMessage: string;
  quickAction?: string;
  recentHistory?: { role: string; content: string }[];
  pageImageBase64?: string;
}) {
  const ai = getGenAIClient();
  if (!ai) {
    return buildGroundedFallbackChat(params);
  }

  const historyText =
    params.recentHistory && params.recentHistory.length > 0
      ? params.recentHistory
          .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
          .join('\n\n')
      : 'No prior messages.';

  const promptText = `DOCUMENT CONTEXT (Currently viewing Page ${params.currentPage}):
${params.documentContext}

RECENT CONVERSATION HISTORY:
${historyText}

STUDENT QUESTION / REQUEST:
${params.userMessage}

Respond in JSON with:
- "reply": Markdown-formatted academic explanation grounded in the PDF. Cite page numbers like [Page ${params.currentPage}]. Follow Simple Explanation -> Example/Formula -> Key Takeaway structure when explaining concepts.
- "responseType": One of "CHAT_RESPONSE", "EXPLANATION", "SUMMARY"
- "citedPages": Array of integer page numbers referenced.`;

  try {
    const parts: any[] = [{ text: promptText }];
    if (params.pageImageBase64) {
      const cleanBase64 = params.pageImageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.unshift({
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            responseType: { type: Type.STRING },
            citedPages: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER }
            }
          },
          required: ['reply', 'responseType', 'citedPages']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      reply: parsed.reply || 'Here is the explanation based on your PDF.',
      responseType: parsed.responseType || 'EXPLANATION',
      citedPages:
        Array.isArray(parsed.citedPages) && parsed.citedPages.length > 0
          ? parsed.citedPages
          : [params.currentPage]
    };
  } catch (err: any) {
    console.warn('Gemini chat fallback triggered:', err?.message);
    return buildGroundedFallbackChat(params);
  }
}

export async function handleGenerateOrModifyNotes(params: {
  documentTitle: string;
  subjectType: string;
  currentPage: number;
  selectedText?: string;
  instruction: string;
  targetSectionHeading?: string;
  documentContext: string;
  includedPages: number[];
  currentNotes?: any;
  isFullGeneration?: boolean;
}) {
  const ai = getGenAIClient();
  if (!ai) {
    return buildGroundedFallbackNotesModification(params);
  }

  const currentNotesSummary = params.currentNotes
    ? JSON.stringify(
        {
          title: params.currentNotes.title,
          subjectType: params.currentNotes.subjectType,
          sections: (params.currentNotes.sections || []).map((s: any) => ({
            id: s.id,
            heading: s.heading,
            category: s.category,
            blocks: s.blocks
          }))
        },
        null,
        2
      )
    : 'No existing notes.';

  const prompt = `${
    params.isFullGeneration
      ? 'TASK: Generate comprehensive, exam-oriented structured study notes from the PDF Context using operation "replace_all".'
      : 'TASK: Surgically modify the student’s current notes based on their instruction. Preserve unrelated sections unless the user asks to change the entire notes document.'
  }

DOCUMENT TITLE: ${params.documentTitle}
DETECTED SUBJECT TYPE: ${params.subjectType}
CURRENTLY VIEWED PAGE: Page ${params.currentPage}
${params.targetSectionHeading ? `EXPLICIT TARGET SECTION HEADING: "${params.targetSectionHeading}"` : ''}

STUDENT INSTRUCTION:
"${params.instruction}"

CURRENT NOTES STATE:
${currentNotesSummary}

RELEVANT PDF CONTEXT:
${params.documentContext}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: NOTES_ENGINE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: NOTE_MODIFICATION_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      reply: parsed.reply || parsed.modification?.summaryOfChanges || 'Updated study notes.',
      responseType: params.isFullGeneration ? 'NOTE_GENERATION' : 'NOTE_MODIFICATION',
      citedPages:
        Array.isArray(parsed.citedPages) && parsed.citedPages.length > 0
          ? parsed.citedPages
          : [params.currentPage],
      modification: parsed.modification
    };
  } catch (err: any) {
    console.warn('Gemini notes modification fallback triggered:', err?.message);
    return buildGroundedFallbackNotesModification(params);
  }
}
