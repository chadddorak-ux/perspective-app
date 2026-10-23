import { NextResponse } from "next/server";
import { z } from "zod";
import { checkTagline } from "@/lib/compliance";
import { firstError } from "@/lib/schemas";
import { updateSponsor } from "@/lib/store";

const svg = z.string().max(200_000).refine((s) => s.trim().startsWith("<svg") && !/<script|on\w+=/i.test(s), "Logos must be plain SVG");
const imageData = z.string().max(2_000_000).regex(/^data:image\/(jpeg|png|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/);

const Patch = z.object({
  brandKit: z
    .object({
      mark: svg,
      wordmark: svg,
      colors: z.array(z.object({ name: z.string().trim().max(40), hex: z.string().regex(/^#[0-9a-f]{6}$/i) })).max(8),
      tagline: z.string().trim().max(120).optional(),
      boilerplate: z.string().trim().max(1200),
      mission: z.string().trim().max(400).optional(),
      website: z.string().trim().max(200).optional(),
      photos: z.array(imageData).max(6).optional(),
      rules: z.array(z.string().trim().max(240)).max(12),
    })
    .optional(),
  fiscalYearEnd: z.coerce.number().int().min(1).max(12).optional(),
  givingBudget: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  disasterPool: z.coerce.number().int().min(0).max(100_000_000).optional(),
  peepPledge: z.object({ kind: z.enum(["percent-profit", "fixed"]), value: z.coerce.number().min(0.1).max(100_000_000) }).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const { brandKit, peepPledge, ...rest } = parsed.data;
  if (brandKit?.tagline) {
    const t = checkTagline(brandKit.tagline);
    if (!t.ok) return NextResponse.json({ error: `Your tagline reads as advertising (${t.problems.join(", ")}). ${t.suggestion}` }, { status: 400 });
  }
  const sp = await updateSponsor(id, {
    ...rest,
    ...(brandKit && { brandKit: { ...brandKit, origin: "brand" as const, updatedAt: new Date().toISOString() } }),
    ...(peepPledge !== undefined && { peepPledge: peepPledge ? { ...peepPledge, since: new Date().toISOString().slice(0, 10) } : undefined }),
  });
  if (!sp) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  return NextResponse.json({ sponsor: sp });
}
