import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/* ------------------------------------------------------------------ *
 * Design tokens & page geometry
 * ------------------------------------------------------------------ */

const PAGE_WIDTH = 595.28;              // A4 portrait (points)
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const TOP_Y = PAGE_HEIGHT - 96;         // first baseline below the running header
const BOTTOM_Y = 58;                    // page-break threshold (footer lives below)

const COLORS = {
  accent:     rgb(0.22, 0.74, 0.97),    // Lumen cyan
  violet:     rgb(0.55, 0.35, 0.95),
  ink:        rgb(0.08, 0.12, 0.22),    // deep obsidian
  heading:    rgb(0.10, 0.15, 0.25),
  body:       rgb(0.20, 0.25, 0.32),
  muted:      rgb(0.45, 0.50, 0.60),
  faint:      rgb(0.50, 0.55, 0.65),
  rule:       rgb(0.88, 0.91, 0.94),
  calloutBg:  rgb(0.95, 0.97, 1.00),
  calloutBd:  rgb(0.80, 0.88, 0.98),
  calloutInk: rgb(0.15, 0.20, 0.30),
  calloutTag: rgb(0.12, 0.45, 0.75),
};

/* ------------------------------------------------------------------ *
 * Sanitisation
 * ------------------------------------------------------------------ */

/**
 * Single-character substitutions for glyphs that the standard PDF fonts
 * (WinAnsi) cannot encode but that authors type all the time.
 * Keyed by code point; the value is the ASCII/Latin-1 stand-in.
 */
const CHAR_REPLACEMENTS = new Map(Object.entries({
  '\u2018': "'", '\u2019': "'", '\u201A': ',', '\u201B': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u00AB': '"', '\u00BB': '"',
  '\u2013': '-', '\u2014': '--', '\u2015': '--', '\u2212': '-',
  '\u2026': '...', '\u2022': '-', '\u00B7': '-', '\u25CF': '-', '\u25AA': '-',
  '\u00A0': ' ', '\u2007': ' ', '\u202F': ' ', '\u2009': ' ',
  '\u200A': ' ', '\u200B': '', '\u200C': '', '\u200D': '', '\uFEFF': '',
  '\u00AD': '',
  '\u2192': '->', '\u2190': '<-', '\u2194': '<->', '\u21D2': '=>',
  '\u2264': '<=', '\u2265': '>=', '\u2260': '!=', '\u2248': '~=',
  '\u00D7': 'x', '\u00F7': '/',
  '\u2713': 'v', '\u2714': 'v', '\u2717': 'x', '\u2718': 'x',
  '\u00AE': '(R)', '\u00A9': '(C)', '\u2122': '(TM)',
  '\u00BD': '1/2', '\u00BC': '1/4', '\u00BE': '3/4', '\u00B0': ' deg',
  '\uFB01': 'fi', '\uFB02': 'fl',
}));

/**
 * Normalise arbitrary text so pdf-lib's WinAnsi standard fonts can encode it.
 * Anything outside Latin-1 is replaced with a space. If you need CJK / Cyrillic
 * / emoji, embed a Unicode TTF with `@pdf-lib/fontkit` instead.
 */
function sanitizeForPdf(text) {
  if (text === null || text === undefined) return '';
  let out = String(text);

  // Only pay the callback cost for non-ASCII characters.
  out = out.replace(/[^\x00-\x7F]/g, (ch) => (
    CHAR_REPLACEMENTS.has(ch) ? CHAR_REPLACEMENTS.get(ch) : ch
  ));

  return out
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')  // drop anything still unencodable
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ *
 * Markdown helpers
 * ------------------------------------------------------------------ */

/** Strip inline markdown syntax that plain-text PDF output would render literally. */
function stripInlineMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')          // images -> alt text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')    // links  -> text (url)
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')             // inline / fenced code
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]+>/g, '')                           // stray HTML tags
    .trim();
}

/**
 * Parse a plain markdown string into structured PDF sections.
 * @returns {Array<{heading: string, content: string, bulletPoints: string[]}>}
 */
export function parseMarkdownToSections(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const sections = [];
  let current = null;

  const flush = () => {
    if (current && (current.content || current.bulletPoints.length > 0)) {
      sections.push(current);
    }
    current = null;
  };

  for (const rawLine of rawText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Horizontal rule -> acts as a section separator.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); continue; }

    // Heading.
    const headingMatch = /^#{1,6}\s+(.*)$/.exec(line);
    if (headingMatch) {
      flush();
      current = {
        heading: stripInlineMarkdown(headingMatch[1]),
        content: '',
        bulletPoints: [],
      };
      continue;
    }

    if (!current) current = { heading: 'Overview', content: '', bulletPoints: [] };

    // Bullet or ordered-list item.
    const listMatch = /^(?:[-*+\u2022]|\d+[.)])\s+(.*)$/.exec(line);
    if (listMatch) {
      current.bulletPoints.push(stripInlineMarkdown(listMatch[1]));
      continue;
    }

    // Block quote -> plain paragraph.
    const paragraph = stripInlineMarkdown(line.replace(/^>\s?/, ''));
    if (!paragraph) continue;
    current.content = current.content ? `${current.content} ${paragraph}` : paragraph;
  }

  flush();
  return sections;
}

/* ------------------------------------------------------------------ *
 * Text layout
 * ------------------------------------------------------------------ */

const measureCache = new WeakMap();

/** Safe width measurement with a graceful fallback for odd fonts. */
function measure(font, size, text) {
  if (!text) return 0;
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.55; // crude approximation
  }
}

/**
 * Width-aware word wrapping. Splits on whitespace and hard-breaks any single
 * word that is wider than the available line, so nothing ever overflows.
 *
 * @returns {string[]} lines of rendered text (already sanitised)
 */
function wrapText(text, font, size, maxWidth) {
  const clean = sanitizeForPdf(text);
  if (!clean || maxWidth <= 0) return [];

  // Cheap memoisation: identical (text, font, size, width) tuples are common.
  let perFont = measureCache.get(font);
  if (!perFont) { perFont = new Map(); measureCache.set(font, perFont); }
  const key = `${size}|${Math.round(maxWidth)}|${clean}`;
  const cached = perFont.get(key);
  if (cached) return cached;

  const lines = [];
  let current = '';

  const flush = () => { if (current) { lines.push(current); current = ''; } };

  for (const word of clean.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(font, size, candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    flush();

    if (measure(font, size, word) <= maxWidth) {
      current = word;
      continue;
    }

    // Word alone is too wide: break it character by character.
    let chunk = '';
    for (const ch of word) {
      if (measure(font, size, chunk + ch) <= maxWidth) {
        chunk += ch;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }

  flush();

  // Bound the cache so long-running processes don't leak.
  if (perFont.size > 500) perFont.clear();
  perFont.set(key, lines);
  return lines;
}

/* ------------------------------------------------------------------ *
 * Layout engine
 * ------------------------------------------------------------------ */

/**
 * Small cursor-style layout helper: keeps track of the active page and the
 * current baseline, inserts page breaks automatically, and stamps a running
 * header on every page plus a footer with page numbers once finalised.
 */
class PdfLayout {
  constructor(doc, fonts, { headerLabel = '', footerNote = '' } = {}) {
    this.doc = doc;
    this.fonts = fonts;
    this.headerLabel = sanitizeForPdf(headerLabel).toUpperCase();
    this.footerNote = sanitizeForPdf(footerNote);
    this.pages = [];
    this.page = null;
    this.y = TOP_Y;
  }

  addPage() {
    const page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(page);
    this.page = page;
    this.y = TOP_Y;

    if (this.headerLabel) {
      page.drawRectangle({
        x: MARGIN_X,
        y: PAGE_HEIGHT - 40,
        width: CONTENT_WIDTH,
        height: 2,
        color: COLORS.accent,
      });
      page.drawText(this.headerLabel, {
        x: MARGIN_X,
        y: PAGE_HEIGHT - 54,
        size: 7.5,
        font: this.fonts.bold,
        color: COLORS.muted,
      });
    }
    return page;
  }

  /** Insert a page break if `height` points of vertical space aren't available. */
  ensureSpace(height) {
    if (this.y - height < BOTTOM_Y) this.addPage();
  }

  /**
   * Draw a wrapped block of text and advance the cursor.
   * @returns {number} the number of lines rendered
   */
  paragraph(text, {
    font = this.fonts.regular,
    size = 9.5,
    color = COLORS.body,
    lineHeight = 14,
    x = MARGIN_X,
    indent = 0,
    width,
    spaceAfter = 0,
  } = {}) {
    const maxWidth = width ?? (CONTENT_WIDTH - indent);
    const lines = wrapText(text, font, size, maxWidth);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, { x: x + indent, y: this.y, size, font, color });
      this.y -= lineHeight;
    }

    if (spaceAfter) this.y -= spaceAfter;
    return lines.length;
  }

  /** Measure how tall a paragraph would be without drawing it. */
  measureParagraph(text, { font = this.fonts.regular, size = 9.5, lineHeight = 14, indent = 0, width } = {}) {
    const maxWidth = width ?? (CONTENT_WIDTH - indent);
    return wrapText(text, font, size, maxWidth).length * lineHeight;
  }

  /** Stamp footers (with "Page X of Y") on every page. Call once, before save. */
  finalize() {
    const total = this.pages.length;
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    this.pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN_X, y: 45 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: 45 },
        thickness: 0.8,
        color: COLORS.rule,
      });

      page.drawText(`Generated on ${dateStr} • Confidential & Proprietary`, {
        x: MARGIN_X,
        y: 32,
        size: 7.5,
        font: this.fonts.regular,
        color: COLORS.faint,
      });

      const right = this.footerNote
        ? `${this.footerNote} • Page ${index + 1} of ${total}`
        : `Page ${index + 1} of ${total}`;

      const rightWidth = measure(this.fonts.italic, 7.5, right);
      page.drawText(right, {
        x: PAGE_WIDTH - MARGIN_X - rightWidth,
        y: 32,
        size: 7.5,
        font: this.fonts.italic,
        color: COLORS.faint,
      });
    });
  }
}

/* ------------------------------------------------------------------ *
 * Portable base64
 * ------------------------------------------------------------------ */

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');

  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Generate a professional, styled PDF document.
 *
 * @param {Object}   options
 * @param {string}   [options.title]
 * @param {string}   [options.subtitle]
 * @param {string}   [options.summary]         Executive-summary callout.
 * @param {Array}    [options.sections]        `{ heading, content, bulletPoints }`
 * @param {string}   [options.content]         Fallback markdown source.
 * @param {string}   [options.author]
 * @param {string}   [options.category]
 * @param {boolean}  [options.numberedSections] Prefix headings with "1.", "2." …
 * @returns {Promise<Object>} base64 + dataUrl payload describing the PDF.
 */
export async function generatePdfDocument({
  title = 'Lumen AI Document',
  subtitle = '',
  summary = '',
  sections = [],
  content = '',
  author = 'Lumen AI Neural Copilot',
  category = 'Report',
  numberedSections = true,
} = {}) {
  const doc = await PDFDocument.create();

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  const safeTitle = sanitizeForPdf(title) || 'Lumen AI Document';
  const safeAuthor = sanitizeForPdf(author) || 'Lumen AI';
  const safeCategory = sanitizeForPdf(category) || 'Report';
  const safeSubtitle = sanitizeForPdf(subtitle);
  const safeSummary = sanitizeForPdf(summary);

  // Document metadata (helps search, printing and accessibility tools).
  const now = new Date();
  doc.setTitle(safeTitle);
  doc.setAuthor(safeAuthor);
  doc.setSubject(safeSubtitle || safeCategory);
  doc.setCreator('Lumen AI Multimodal Engine');
  doc.setProducer('pdf-lib');
  doc.setCreationDate(now);
  doc.setModificationDate(now);

  // Resolve sections.
  let resolvedSections = Array.isArray(sections) ? sections.filter(Boolean) : [];
  if (resolvedSections.length === 0 && typeof content === 'string' && content.trim()) {
    resolvedSections = parseMarkdownToSections(content);
  }

  const layout = new PdfLayout(doc, fonts, {
    headerLabel: 'Lumen AI — Ambient Intelligence',
    footerNote: 'Lumen AI Multimodal Engine',
  });
  layout.addPage();

  /* ---- Category tag ------------------------------------------------ */
  layout.page.drawText(safeCategory.toUpperCase(), {
    x: MARGIN_X,
    y: layout.y,
    size: 8,
    font: fonts.bold,
    color: COLORS.violet,
  });
  layout.y -= 26;

  /* ---- Title ------------------------------------------------------- */
  layout.paragraph(safeTitle, {
    font: fonts.bold,
    size: 22,
    color: COLORS.ink,
    lineHeight: 27,
  });

  /* ---- Subtitle ---------------------------------------------------- */
  if (safeSubtitle) {
    layout.y -= 2;
    layout.paragraph(safeSubtitle, {
      font: fonts.italic,
      size: 11,
      color: rgb(0.35, 0.42, 0.52),
      lineHeight: 15,
    });
  }

  /* ---- Metadata row ------------------------------------------------ */
  layout.y -= 10;
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  layout.paragraph(`Date: ${dateStr}   |   Author: ${safeAuthor}`, {
    size: 8.5,
    color: COLORS.muted,
    lineHeight: 12,
  });

  /* ---- Divider ----------------------------------------------------- */
  layout.y -= 10;
  layout.page.drawLine({
    start: { x: MARGIN_X, y: layout.y },
    end: { x: PAGE_WIDTH - MARGIN_X, y: layout.y },
    thickness: 1,
    color: COLORS.rule,
  });
  layout.y -= 24;

  /* ---- Executive summary callout ----------------------------------- */
  if (safeSummary) {
    const boxLines = wrapText(safeSummary, fonts.regular, 9.5, CONTENT_WIDTH - 32);
    const boxHeight = 30 + boxLines.length * 14;

    layout.ensureSpace(boxHeight + 16);

    const boxTop = layout.y + 12;
    const boxBottom = boxTop - boxHeight;

    layout.page.drawRectangle({
      x: MARGIN_X,
      y: boxBottom,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: COLORS.calloutBg,
      borderColor: COLORS.calloutBd,
      borderWidth: 1,
    });

    // Left accent bar.
    layout.page.drawRectangle({
      x: MARGIN_X,
      y: boxBottom,
      width: 4,
      height: boxHeight,
      color: COLORS.accent,
    });

    layout.page.drawText('EXECUTIVE SUMMARY', {
      x: MARGIN_X + 16,
      y: boxTop - 16,
      size: 8.5,
      font: fonts.bold,
      color: COLORS.calloutTag,
    });

    let lineY = boxTop - 32;
    for (const line of boxLines) {
      layout.page.drawText(line, {
        x: MARGIN_X + 16,
        y: lineY,
        size: 9.5,
        font: fonts.regular,
        color: COLORS.calloutInk,
      });
      lineY -= 14;
    }

    layout.y = boxBottom - 22;
  }

  /* ---- Body sections ----------------------------------------------- */
  resolvedSections.forEach((section, index) => {
    if (!section || typeof section !== 'object') return;

    const headingRaw = sanitizeForPdf(section.heading);
    const headingText = headingRaw
      ? (numberedSections ? `${index + 1}. ${headingRaw}` : headingRaw)
      : '';

    const bodyText = sanitizeForPdf(section.content);
    const bullets = Array.isArray(section.bulletPoints)
      ? section.bulletPoints.map(sanitizeForPdf).filter(Boolean)
      : [];

    if (!headingText && !bodyText && bullets.length === 0) return;

    // Keep the heading with at least the first two body lines (no orphans).
    if (headingText) {
      const headingLines = wrapText(headingText, fonts.bold, 13, CONTENT_WIDTH);
      const headingHeight = headingLines.length * 18;
      const orphanGuard = bodyText || bullets.length ? 28 : 0;
      layout.ensureSpace(headingHeight + orphanGuard);

      for (const line of headingLines) {
        layout.page.drawText(line, {
          x: MARGIN_X,
          y: layout.y,
          size: 13,
          font: fonts.bold,
          color: COLORS.heading,
        });
        layout.y -= 18;
      }
      layout.y -= 2;
    }

    // Paragraph body.
    if (bodyText) {
      layout.paragraph(bodyText, {
        size: 9.5,
        color: COLORS.body,
        lineHeight: 14,
      });
      layout.y -= 6;
    }

    // Bullet list.
    if (bullets.length) {
      const bulletWidth = CONTENT_WIDTH - 24;

      for (const bullet of bullets) {
        const lines = wrapText(bullet, fonts.regular, 9.5, bulletWidth);

        lines.forEach((line, lineIndex) => {
          layout.ensureSpace(13);

          if (lineIndex === 0) {
            layout.page.drawCircle({
              x: MARGIN_X + 12,
              y: layout.y + 3,
              size: 2.2,
              color: COLORS.accent,
            });
          }

          layout.page.drawText(line, {
            x: MARGIN_X + 24,
            y: layout.y,
            size: 9.5,
            font: fonts.regular,
            color: COLORS.body,
          });
          layout.y -= 13;
        });
      }
      layout.y -= 8;
    }

    layout.y -= 12;
  });

  /* ---- Footers + serialisation ------------------------------------- */
  layout.finalize();

  const pdfBytes = await doc.save();
  const base64 = toBase64(pdfBytes);
  const pageCount = doc.getPageCount();

  const cleanTitle = (safeTitle || 'document')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32) || 'document';
  const fileName = `${cleanTitle}_${Date.now()}.pdf`;

  return {
    success: true,
    widgetType: 'pdf_document',
    title: safeTitle,
    subtitle: safeSubtitle,
    fileName,
    pageCount,
    sizeBytes: pdfBytes.length,
    base64,
    dataUrl: `data:application/pdf;base64,${base64}`,
    summary: safeSummary || `Generated ${pageCount}-page PDF document: "${safeTitle}"`,
  };
}

/**
 * Generate a PDF export of a conversation history log.
 *
 * @param {Array<{role?: string, text?: string, content?: string, timestamp?: string|number|Date}>} messages
 * @param {{name?: string}|null} [user]
 */
export async function exportConversationToPdf(messages = [], user = null) {
  const list = Array.isArray(messages) ? messages : [];
  const validMessages = list.filter((m) => m && (m.text || m.content));

  const sections = validMessages.map((msg) => {
    const isUser = msg.role === 'user';
    const speaker = isUser ? (user?.name || 'User') : 'Lumen AI';

    let timeStr = '';
    if (msg.timestamp) {
      const when = new Date(msg.timestamp);
      if (!Number.isNaN(when.getTime())) {
        timeStr = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }

    return {
      heading: timeStr ? `${speaker} (${timeStr})` : speaker,
      content: String(msg.text ?? msg.content),
    };
  });

  return generatePdfDocument({
    title: 'Lumen AI Conversation Transcript',
    subtitle: `Archived dialogue session with ${user?.name || 'Guest User'}`,
    summary: `Complete archive containing ${validMessages.length} interaction(s) synthesized with Lumen AI.`,
    category: 'Transcript Archive',
    author: user?.name || 'Lumen AI',
    sections,
    numberedSections: false,
  });
}