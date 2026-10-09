import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const message = (body as { message?: unknown })?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 5000) {
    return NextResponse.json({ error: "Enter a message up to 5,000 characters." }, { status: 400 });
  }
  try {
    const id = crypto.randomUUID();
    const receiptToken = crypto.randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    await db.batch([
      db.prepare("UPDATE messages SET body = '' WHERE expires_at <= ? AND body <> ''").bind(createdAt.toISOString()),
      db.prepare("INSERT INTO messages (id, body, created_at, expires_at, receipt_token) VALUES (?, ?, ?, ?, ?)").bind(id, message.trim(), createdAt.toISOString(), expiresAt.toISOString(), receiptToken),
    ]);
    return NextResponse.json({ id, receiptToken, expiresAt: expiresAt.toISOString() });
  } catch {
    return NextResponse.json({ error: "Message storage is unavailable. Please try again." }, { status: 503 });
  }
}
