import { NextResponse } from "next/server";
import { z } from "zod";
import { firstError } from "@/lib/schemas";
import { getPledge, updatePledge } from "@/lib/store";
import type { Pledge } from "@/lib/types";

const imageData = z.string().max(2_000_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Photos must be JPEG, PNG or WebP");

// What can happen to a pledge after it's made. In this prototype no money
// moves: "clear" stands in for the transfer landing in the nonprofit's account.
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("acknowledge") }),
  z.object({ action: z.literal("proof"), image: imageData, note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("approve-proof"), proofId: z.string().min(1) }),
  z.object({ action: z.literal("revoke-kit") }),
  z.object({ action: z.literal("restore-kit") }),
  z.object({ action: z.literal("renew"), renews: z.boolean() }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Action.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const pledge = await getPledge(id);
  if (!pledge) return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
  const now = new Date().toISOString();
  const a = parsed.data;
  let patch: Partial<Pledge>;
  switch (a.action) {
    case "clear":
      patch = { clearedAt: pledge.clearedAt ?? now, status: "confirmed" };
      break;
    case "acknowledge":
      if (!pledge.clearedAt) return NextResponse.json({ error: "The transfer hasn't cleared yet" }, { status: 409 });
      patch = { acknowledgedAt: pledge.acknowledgedAt ?? now };
      break;
    case "proof":
      if (pledge.recognition === "anonymous") return NextResponse.json({ error: "This gift is anonymous: there's no recognition to prove" }, { status: 409 });
      patch = { proofs: [...(pledge.proofs ?? []), { id: `proof-${Date.now().toString(36)}`, image: a.image, note: a.note, status: "submitted", at: now }] };
      break;
    case "approve-proof":
      patch = { proofs: (pledge.proofs ?? []).map((p) => (p.id === a.proofId ? { ...p, status: "approved" as const } : p)) };
      break;
    case "revoke-kit":
      patch = { kitRevoked: true };
      break;
    case "restore-kit":
      patch = { kitRevoked: false };
      break;
    case "renew":
      patch = { renews: a.renews };
      break;
  }
  return NextResponse.json({ pledge: await updatePledge(id, patch) });
}
