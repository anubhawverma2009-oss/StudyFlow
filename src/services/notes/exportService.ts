import { jsPDF } from 'jspdf';
import { NotesDocument } from '../../types/workspace';
import { notesToMarkdown } from './noteEngine';

function sanitizeFileName(title: string): string {
  return (
    title
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'ScholarSync_Notes'
  );
}

export function exportNotesAsMarkdown(notes: NotesDocument): void {
  const md = notesToMarkdown(notes);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(notes.title)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportNotesAsDocx(notes: NotesDocument): void {
  const sectionsHtml = notes.sections
    .map((sec) => {
      const blocksHtml = sec.blocks
        .map((blk) => {
          switch (blk.type) {
            case 'paragraph':
              return `<p>${blk.title ? `<strong>${blk.title}: </strong>` : ''}${blk.content}</p>`;
            case 'bullet_list':
              return `${blk.title ? `<p><strong>${blk.title}</strong></p>` : ''}<ul>${(blk.items || [])
                .map((i) => `<li>${i}</li>`)
                .join('')}</ul>`;
            case 'numbered_list':
              return `${blk.title ? `<p><strong>${blk.title}</strong></p>` : ''}<ol>${(blk.items || [])
                .map((i) => `<li>${i}</li>`)
                .join('')}</ol>`;
            case 'definition':
              return `<div style="border-left:4px solid #2563EB;background:#EFF6FF;padding:10px 14px;margin:10px 0;"><strong>Definition — ${
                blk.title || 'Term'
              }:</strong> ${blk.content}</div>`;
            case 'formula':
              return `<div style="border:1px solid #CBD5E1;background:#F8FAFC;padding:10px 14px;margin:10px 0;font-family:Courier New,monospace;">${
                blk.title ? `<div><strong>${blk.title}</strong></div>` : ''
              }<code>${blk.content}</code></div>`;
            case 'example':
              return `<div style="border-left:4px solid #059669;background:#ECFDF5;padding:10px 14px;margin:10px 0;"><strong>Example${
                blk.title ? ` (${blk.title})` : ''
              }:</strong> ${blk.content}</div>`;
            case 'exam_tip':
            case 'callout':
              return `<div style="border-left:4px solid #D97706;background:#FFFBEB;padding:10px 14px;margin:10px 0;"><strong>${
                blk.title || 'Exam Tip'
              }:</strong> ${blk.content}</div>`;
            case 'code':
              return `<pre style="background:#0F172A;color:#F8FAFC;padding:12px;font-family:Courier New,monospace;">${blk.content}</pre>`;
            case 'table':
              if (!blk.tableData) return '';
              return `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin:12px 0;">
                <thead><tr style="background:#F1F5F9;">${blk.tableData.headers
                  .map((h) => `<th>${h}</th>`)
                  .join('')}</tr></thead>
                <tbody>${blk.tableData.rows
                  .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
                  .join('')}</tbody>
              </table>`;
            default:
              return `<p>${blk.content}</p>`;
          }
        })
        .join('\n');

      return `<h2>${sec.heading}</h2>\n${blocksHtml}`;
    })
    .join('\n<hr style="border:none;border-top:1px solid #E2E8F0;margin:20px 0;"/>\n');

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${notes.title}</title>
    <style>
      body { font-family: 'Calibri', 'Arial', sans-serif; color: #0F172A; line-height: 1.5; }
      h1 { font-size: 22pt; color: #0F172A; border-bottom: 2px solid #1E40AF; padding-bottom: 6px; }
      h2 { font-size: 15pt; color: #1E3A8A; margin-top: 18px; }
      p, li { font-size: 11pt; }
    </style>
    </head>
    <body>
      <h1>${notes.title}</h1>
      <p style="color:#64748B;font-size:9.5pt;">Generated in ScholarSync AI Workspace • Version ${notes.version}</p>
      ${sectionsHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(notes.title)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportNotesAsPdf(notes: NotesDocument): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = 56;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      pdf.addPage();
      y = 52;
    }
  };

  pdf.setFont('times', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(15, 23, 42);
  const titleLines = pdf.splitTextToSize(notes.title, contentWidth);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 24 + 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `ScholarSync Study Notes  •  Version ${notes.version}  •  Exported ${new Date().toLocaleDateString()}`,
    margin,
    y
  );
  y += 14;

  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(1.5);
  pdf.line(margin, y, pageWidth - margin, y);
  pdf.setLineWidth(0.5);
  y += 22;

  for (const section of notes.sections) {
    ensureSpace(48);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13.5);
    pdf.setTextColor(30, 58, 138);
    pdf.text(section.heading, margin, y);
    y += 18;

    for (const block of section.blocks) {
      switch (block.type) {
        case 'paragraph': {
          pdf.setFont('times', 'normal');
          pdf.setFontSize(10.5);
          pdf.setTextColor(30, 41, 59);
          const text = block.title ? `${block.title}: ${block.content}` : block.content;
          const lines = pdf.splitTextToSize(text, contentWidth);
          ensureSpace(lines.length * 14 + 10);
          pdf.text(lines, margin, y);
          y += lines.length * 14 + 10;
          break;
        }

        case 'bullet_list':
        case 'numbered_list': {
          if (block.title) {
            ensureSpace(18);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(15, 23, 42);
            pdf.text(block.title, margin, y);
            y += 14;
          }
          pdf.setFont('times', 'normal');
          pdf.setFontSize(10.5);
          pdf.setTextColor(30, 41, 59);
          (block.items || []).forEach((item, idx) => {
            const prefix = block.type === 'numbered_list' ? `${idx + 1}. ` : '• ';
            const lines = pdf.splitTextToSize(prefix + item, contentWidth - 12);
            ensureSpace(lines.length * 14 + 6);
            pdf.text(lines, margin + 8, y);
            y += lines.length * 14 + 4;
          });
          y += 6;
          break;
        }

        case 'definition':
        case 'example':
        case 'exam_tip':
        case 'callout': {
          const label =
            block.type === 'definition'
              ? `DEFINITION: ${block.title || ''}`
              : block.type === 'example'
              ? `EXAMPLE: ${block.title || ''}`
              : `EXAM TIP: ${block.title || ''}`;
          const bodyLines = pdf.splitTextToSize(block.content, contentWidth - 24);
          const boxH = 26 + bodyLines.length * 13.5;
          ensureSpace(boxH + 12);

          if (block.type === 'definition') {
            pdf.setFillColor(239, 246, 255);
            pdf.setDrawColor(147, 197, 253);
          } else if (block.type === 'example') {
            pdf.setFillColor(236, 253, 245);
            pdf.setDrawColor(110, 231, 183);
          } else {
            pdf.setFillColor(255, 251, 235);
            pdf.setDrawColor(252, 211, 77);
          }

          pdf.roundedRect(margin, y, contentWidth, boxH, 4, 4, 'FD');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8.5);
          pdf.setTextColor(15, 23, 42);
          pdf.text(label, margin + 12, y + 14);

          pdf.setFont('times', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(30, 41, 59);
          pdf.text(bodyLines, margin + 12, y + 28);
          y += boxH + 12;
          break;
        }

        case 'formula':
        case 'code': {
          const lines = pdf.splitTextToSize(block.content, contentWidth - 24);
          const boxH = (block.title ? 26 : 14) + lines.length * 13;
          ensureSpace(boxH + 12);

          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(203, 213, 225);
          pdf.roundedRect(margin, y, contentWidth, boxH, 3, 3, 'FD');

          let innerY = y + 14;
          if (block.title) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.setTextColor(71, 85, 105);
            pdf.text(block.title, margin + 12, innerY);
            innerY += 14;
          }

          pdf.setFont('courier', 'bold');
          pdf.setFontSize(9.5);
          pdf.setTextColor(15, 23, 42);
          pdf.text(lines, margin + 12, innerY);
          y += boxH + 12;
          break;
        }

        case 'table': {
          if (block.tableData && block.tableData.headers.length > 0) {
            const cols = block.tableData.headers.length;
            const colW = contentWidth / cols;
            const rowH = 18;
            const totalH = (block.tableData.rows.length + 1) * rowH + 16;
            ensureSpace(totalH);

            pdf.setFillColor(241, 245, 249);
            pdf.setDrawColor(203, 213, 225);
            pdf.rect(margin, y, contentWidth, rowH, 'FD');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.setTextColor(15, 23, 42);
            block.tableData.headers.forEach((h, cIdx) => {
              pdf.text(h.slice(0, 28), margin + cIdx * colW + 5, y + 12);
            });
            y += rowH;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            block.tableData.rows.forEach((row) => {
              pdf.setDrawColor(226, 232, 240);
              pdf.rect(margin, y, contentWidth, rowH, 'S');
              row.forEach((cell, cIdx) => {
                pdf.text(String(cell).slice(0, 32), margin + cIdx * colW + 5, y + 12);
              });
              y += rowH;
            });
            y += 12;
          }
          break;
        }
      }
    }

    y += 8;
  }

  pdf.save(`${sanitizeFileName(notes.title)}.pdf`);
}

export async function copyNotesToClipboard(notes: NotesDocument): Promise<boolean> {
  try {
    const md = notesToMarkdown(notes);
    await navigator.clipboard.writeText(md);
    return true;
  } catch {
    return false;
  }
}
