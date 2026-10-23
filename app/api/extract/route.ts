import { NextResponse } from "next/server";
import { aiConfigured, extractWithAI } from "@/lib/ai-extract";
import { extractWithRules } from "@/lib/extract";

export const maxDuration = 120;

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const { text = "", pdfBase64 } = (await req.json().catch(() => ({}))) as { text?: string; pdfBase64?: string };
  if (!text.trim() && !pdfBase64) {
    return NextResponse.json({ error: "Paste a pitch or attach a sponsorship PDF" }, { status: 400 });
  }
  if (text.length > 100_000) return NextResponse.json({ error: "That's a lot of text — trim it to the pitch itself" }, { status: 413 });
  if (pdfBase64 && pdfBase64.length * 0.75 > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF is larger than 20 MB" }, { status: 413 });
  }

  if (aiConfigured()) {
    try {
      return NextResponse.json(await extractWithAI(text, pdfBase64));
    } catch (err) {
      console.error("AI extraction failed, falling back to rules", err);
      const result = extractWithRules(text);
      result.warnings.unshift("AI extraction was unavailable, so this was parsed with basic rules — double-check each field.");
      return NextResponse.json(result);
    }
  }

  // Without AI the browser sends the PDF's text layer, which the rules parser reads.
  const result = extractWithRules(text);
  if (pdfBase64 && !text.trim()) {
    result.warnings.unshift("This PDF has no readable text (it may be a scan). Set ANTHROPIC_API_KEY to read scanned pages, or fill in the fields below.");
  }
  return NextResponse.json(result);
}
