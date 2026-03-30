// file: supabase/functions/extract-pdf/index.ts
// Runtime: Supabase Edge Function (Deno) for PDF text extraction

// --- Constants & Utils ---
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const nowIso = () => new Date().toISOString();
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// --- PDF.js Type Definitions ---

/**
 * Represents a text item extracted from a PDF page.
 * This interface models the structure returned by PDF.js getTextContent().
 */
interface PDFTextItem {
  /** The actual text content of this item */
  str: string;
  /** Text direction ('ltr' or 'rtl') */
  dir?: string;
  /** Transformation matrix for positioning */
  transform?: number[];
  /** Width of the text item */
  width?: number;
  /** Height of the text item */
  height?: number;
}

/**
 * Type guard to check if an item from PDF.js textContent is a valid text item.
 * PDF.js can return both TextItem and TextMarkedContent, so we filter for items with 'str' property.
 *
 * @param item - The item to check from textContent.items array
 * @returns True if the item has a valid string property
 */
function isTextItem(item: unknown): item is PDFTextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as PDFTextItem).str === 'string'
  );
}

// --- Helper Functions ---

/**
 * Cleans extracted text by normalizing whitespace, fixing URLs, and improving readability.
 *
 * Performs the following transformations:
 * - Fixes LinkedIn URLs to proper format with https://
 * - Adds line breaks after sentences for better readability
 * - Removes page number markers (e.g., "Page 1 of 5")
 * - Normalizes excessive whitespace
 *
 * @param text - The raw text extracted from PDF
 * @returns Cleaned text with normalized formatting
 */
function cleanExtractedText(text: string): string {
  let cleaned = text;

  cleaned = cleaned.replace(/www\.linkedin\.com\/in\/([a-zA-Z0-9-]+)\s*-\s*([a-zA-Z0-9-]+)/g,
    (match, part1, part2) => `https://www.linkedin.com/in/${part1}-${part2}/`);

  cleaned = cleaned.replace(/(?<!https:\/\/)www\.linkedin\.com\/in\/([a-zA-Z0-9-]+)\/?/g,
    (match, username) => `https://www.linkedin.com/in/${username}/`);

  cleaned = cleaned.replace(/\.\s{2,}/g, '.\n\n');

  cleaned = cleaned.replace(/\.\s/g, '.\n');

  cleaned = cleaned.replace(/\)\s{2,}/g, ')\n');

  cleaned = cleaned.replace(/\s*Page\s+\d+\s+of\s+\d+\s*/gi, '');

  cleaned = cleaned.replace(/\s{3,}/g, ' ');

  return cleaned.trim();
}

/**
 * Extracts text content from a PDF file buffer.
 *
 * Uses pdfjs-serverless library optimized for Deno/Edge environments.
 * Processes each page sequentially and combines the text with newline separators.
 *
 * @param fileBuffer - The PDF file as a Uint8Array buffer
 * @returns Promise containing extracted text and page count
 * @throws Error if PDF parsing or text extraction fails
 */
async function extractTextFromPDF(fileBuffer: Uint8Array): Promise<{ text: string; pageCount: number }> {
  try {
    const { resolvePDFJS } = await import("https://esm.sh/pdfjs-serverless@0.4.2");

    const { getDocument } = await resolvePDFJS();

    const doc = await getDocument({ data: fileBuffer, useSystemFonts: true }).promise;

    const allText: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const contents = textContent.items
        .filter(isTextItem)
        .map((item) => item.str)
        .join(" ");
      allText.push(contents);
    }

    return {
      text: allText.join("\n").trim(),
      pageCount: doc.numPages
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract text from PDF: ${message}`);
  }
}

// --- Handler ---
Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log("[extract-pdf] Request received:", req.method);

  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }

    if (req.method !== "POST") {
      return Response.json(
        { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST requests are accepted" } },
        { status: 405, headers: CORS }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json(
        { error: { code: "INVALID_CONTENT_TYPE", message: "Content-Type must be multipart/form-data" } },
        { status: 400, headers: CORS }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") || formData.get("pdf");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: { code: "FILE_REQUIRED", message: "No file uploaded. Please include a file in the 'file' or 'pdf' field" } },
        { status: 400, headers: CORS }
      );
    }

    const fileName = file.name.toLowerCase();
    const fileMimeType = file.type;
    const isPDF = fileName.endsWith(".pdf") || fileMimeType === "application/pdf";

    if (!isPDF) {
      return Response.json(
        { error: { code: "INVALID_FILE_TYPE", message: `Invalid file type. Expected PDF but got: ${fileMimeType || "unknown"}` } },
        { status: 415, headers: CORS }
      );
    }

    const fileSize = file.size;
    console.log("[extract-pdf] File:", { name: file.name, size: fileSize, type: fileMimeType });

    if (fileSize > MAX_FILE_SIZE) {
      return Response.json(
        { error: { code: "FILE_TOO_LARGE", message: `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` } },
        { status: 413, headers: CORS }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    console.log("[extract-pdf] Starting extraction...");
    const { text, pageCount } = await extractTextFromPDF(fileBuffer);

    const cleanedText = cleanExtractedText(text);
    const duration = Date.now() - startTime;

    console.log("[extract-pdf] Complete:", { pageCount, textLength: cleanedText.length, durationMs: duration });

    const response = {
      success: true,
      text: cleanedText,
      metadata: {
        pageCount,
        fileSize,
        fileName: file.name,
        extractedAt: nowIso(),
        durationMs: duration
      }
    };

    return Response.json(response, { headers: CORS });

  } catch (err: unknown) {
    let status = 500;
    let code = "INTERNAL_ERROR";
    const message = err instanceof Error ? err.message : "Unexpected error occurred";

    if (message.includes("Failed to extract text from PDF")) {
      code = "PDF_EXTRACTION_FAILED";
      status = 500;
    }

    console.error("[extract-pdf] Error:", { code, message });

    return Response.json(
      { error: { code, message } },
      { status, headers: CORS }
    );
  }
});
