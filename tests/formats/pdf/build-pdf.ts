/**
 * @fileoverview A minimal PDF writer for tests: pages of text set at given positions in
 * the standard Helvetica faces, with an exact cross-reference table, so a test controls
 * the layout the parser sees. A page can share an earlier page's content stream.
 * @module tests/formats/pdf/build-pdf
 */

/** One run of text, positioned by its baseline's left end in PDF points. */
export interface TextSpec {
  font?: 'bold' | 'italic' | 'regular';
  size?: number;
  text: string;
  x: number;
  y: number;
}

export interface PdfSpec {
  height?: number;
  /** Entries for the document Info dictionary (`Title`, `Author`). */
  info?: Record<string, string>;
  /** Each page's text, or the index of an earlier page whose content stream it points at. */
  pages: (TextSpec[] | number)[];
  width?: number;
}

const FONT_RESOURCE = { bold: 'F2', italic: 'F3', regular: 'F1' } as const;

function literal(text: string): string {
  return `(${text.replace(/[\\()]/g, (char) => `\\${char}`)})`;
}

/** Build the PDF. Text must be ASCII. */
export function buildPdf({ height = 792, info, pages, width = 612 }: PdfSpec): Uint8Array {
  const bodies: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
  ];
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (const page of pages) {
    const pageId = bodies.push('');
    let contentId: number | undefined;
    if (typeof page === 'number') {
      contentId = contentIds[page];
      if (contentId === undefined) throw new Error(`Page ${page} is not an earlier page`);
    } else {
      const content = page
        .map(
          ({ font = 'regular', size = 10, text, x, y }) =>
            `BT /${FONT_RESOURCE[font]} ${size} Tf 1 0 0 1 ${x} ${y} Tm ${literal(text)} Tj ET`,
        )
        .join('\n');
      contentId = bodies.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    }
    bodies[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
    contentIds.push(contentId);
  }
  bodies[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  const infoId = info
    ? bodies.push(
        `<< ${Object.entries(info)
          .map(([key, value]) => `/${key} ${literal(value)}`)
          .join(' ')} >>`,
      )
    : undefined;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [i, body] of bodies.entries()) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R${infoId ? ` /Info ${infoId} 0 R` : ''} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

/** Lines of body text starting at `y`, one every `leading` points. */
export function paragraph(
  lines: string[],
  {
    leading = 12,
    size = 10,
    x = 72,
    y,
  }: { leading?: number; size?: number; x?: number; y: number },
): TextSpec[] {
  return lines.map((text, i) => ({ size, text, x, y: y - i * leading }));
}
