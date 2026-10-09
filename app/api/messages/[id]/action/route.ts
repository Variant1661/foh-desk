import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  let action: unknown;
  try { action = (await request.json() as { action?: unknown }).action; }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (action !== "acknowledge" && action !== "keep" && action !== "destroy") {
    return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
  }
  const now = new Date().toISOString();
  try {
    await db.prepare("UPDATE messages SET body = '' WHERE id = ? AND expires_at <= ? AND body <> ''").bind(id, now).run();
    const query = action === "acknowledge"
      ? "UPDATE messages SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE id = ? AND expires_at > ? AND destroyed_at IS NULL"
      : action === "keep"
        ? "UPDATE messages SET kept_at = COALESCE(kept_at, ?) WHERE id = ? AND expires_at > ? AND destroyed_at IS NULL"
        : "UPDATE messages SET body = '', destroyed_at = COALESCE(destroyed_at, ?) WHERE id = ? AND expires_at > ? AND destroyed_at IS NULL";
    const result = await db.prepare(query).bind(now, id, now).run();
    if (!result.meta.changes) return NextResponse.json({ error: "This message is no longer available." }, { status: 410 });
    return NextResponse.json({ action, at: now }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save your choice. Please try again." }, { status: 503 });
  }
}
