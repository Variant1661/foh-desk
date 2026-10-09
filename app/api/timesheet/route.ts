import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sessionName } from "@/lib/auth";

type EntryInput = { id?: unknown; name?: unknown; originalName?: unknown; date?: unknown; timeIn?: unknown; timeOut?: unknown };
const validName = (name: unknown): name is "FOH1" | "FOH2" | "FOH3" => name === "FOH1" || name === "FOH2" || name === "FOH3";
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const validTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const unavailable = () => NextResponse.json({ error: "Timesheet storage is unavailable. Please try again." }, { status: 503 });
const bad = () => NextResponse.json({ error: "Choose FOH1, FOH2, or FOH3 and enter a valid date and time in." }, { status: 400 });

export async function GET(request: Request) {
  const signedIn = await sessionName();
  if (!signedIn) return NextResponse.json({ error: "Sign in to view your timesheet." }, { status: 401 });
  const name = new URL(request.url).searchParams.get("name");
  if (name !== "ALL" && !validName(name)) return bad();
  if (signedIn !== "ADMIN" && name !== signedIn) return NextResponse.json({ error: "This timesheet belongs to another person." }, { status: 403 });
  try {
    const result = name === "ALL"
      ? await db.prepare("SELECT id, name, date, time_in AS timeIn, time_out AS timeOut FROM timesheet_entries ORDER BY date DESC, time_in DESC, created_at DESC").bind().all()
      : await db.prepare("SELECT id, name, date, time_in AS timeIn, time_out AS timeOut FROM timesheet_entries WHERE name = ? ORDER BY date DESC, time_in DESC, created_at DESC").bind(name).all();
    return NextResponse.json({ entries: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}

async function parse(request: Request): Promise<EntryInput | null> {
  try { return await request.json(); } catch { return null; }
}

export async function POST(request: Request) {
  const signedIn = await sessionName();
  if (!signedIn) return NextResponse.json({ error: "Sign in to save your timesheet." }, { status: 401 });
  const input = await parse(request);
  if (!input || !validName(input.name) || !validDate(input.date) || !validTime(input.timeIn) || !(input.timeOut == null || validTime(input.timeOut))) return bad();
  if (signedIn !== "ADMIN" && input.name !== signedIn) return NextResponse.json({ error: "This timesheet belongs to another person." }, { status: 403 });
  try {
    if (input.timeOut == null) {
      const open = await db.prepare("SELECT id FROM timesheet_entries WHERE name = ? AND time_out IS NULL LIMIT 1").bind(input.name).first();
      if (open) return NextResponse.json({ error: "Clock out the open entry before clocking in again." }, { status: 409 });
    }
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO timesheet_entries (id, name, date, time_in, time_out, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, input.name, input.date, input.timeIn, input.timeOut ?? null, new Date().toISOString()).run();
    return NextResponse.json({ id }, { status: 201 });
  } catch { return unavailable(); }
}

export async function PUT(request: Request) {
  const signedIn = await sessionName();
  if (!signedIn) return NextResponse.json({ error: "Sign in to save your timesheet." }, { status: 401 });
  const input = await parse(request);
  if (!input || typeof input.id !== "string" || !validName(input.name) || !validDate(input.date) || !validTime(input.timeIn) || !(input.timeOut == null || validTime(input.timeOut))) return bad();
  const originalName = input.originalName ?? input.name;
  if (!validName(originalName)) return bad();
  if (signedIn !== "ADMIN" && (input.name !== signedIn || originalName !== signedIn)) return NextResponse.json({ error: "This timesheet belongs to another person." }, { status: 403 });
  try {
    const result = await db.prepare("UPDATE timesheet_entries SET name = ?, date = ?, time_in = ?, time_out = ? WHERE id = ? AND name = ?")
      .bind(input.name, input.date, input.timeIn, input.timeOut ?? null, input.id, originalName).run();
    if (!result.meta.changes) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    return NextResponse.json({ id: input.id });
  } catch { return unavailable(); }
}

export async function DELETE(request: Request) {
  const signedIn = await sessionName();
  if (!signedIn) return NextResponse.json({ error: "Sign in to delete an entry." }, { status: 401 });
  let input: { id?: unknown; name?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof input?.id !== "string" || !validName(input.name)) return bad();
  if (signedIn !== "ADMIN" && input.name !== signedIn) return NextResponse.json({ error: "This timesheet belongs to another person." }, { status: 403 });
  try {
    const result = db.prepare("DELETE FROM timesheet_entries WHERE id = ? AND name = ?").bind(input.id, input.name).run();
    if (!result.meta.changes) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}
