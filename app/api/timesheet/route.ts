import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type EntryInput = { id?: unknown; name?: unknown; date?: unknown; timeIn?: unknown; timeOut?: unknown };
const validName = (name: unknown): name is "FOH1" | "FOH2" | "FOH3" => name === "FOH1" || name === "FOH2" || name === "FOH3";
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const validTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const unavailable = () => NextResponse.json({ error: "Timesheet storage is unavailable. Please try again." }, { status: 503 });
const bad = () => NextResponse.json({ error: "Choose FOH1, FOH2, or FOH3 and enter a valid date and time in." }, { status: 400 });

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name");
  if (!validName(name)) return bad();
  try {
    const result = await db.prepare("SELECT id, name, date, time_in AS timeIn, time_out AS timeOut FROM timesheet_entries WHERE name = ? ORDER BY date DESC, time_in DESC, created_at DESC LIMIT 200").bind(name).all();
    return NextResponse.json({ entries: result.results });
  } catch { return unavailable(); }
}

async function parse(request: Request): Promise<EntryInput | null> {
  try { return await request.json(); } catch { return null; }
}

export async function POST(request: Request) {
  const input = await parse(request);
  if (!input || !validName(input.name) || !validDate(input.date) || !validTime(input.timeIn) || !(input.timeOut == null || validTime(input.timeOut))) return bad();
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
  const input = await parse(request);
  if (!input || typeof input.id !== "string" || !validName(input.name) || !validDate(input.date) || !validTime(input.timeIn) || !(input.timeOut == null || validTime(input.timeOut))) return bad();
  try {
    const result = await db.prepare("UPDATE timesheet_entries SET date = ?, time_in = ?, time_out = ? WHERE id = ? AND name = ?").bind(input.date, input.timeIn, input.timeOut ?? null, input.id, input.name).run();
    if (!result.meta.changes) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    return NextResponse.json({ id: input.id });
  } catch { return unavailable(); }
}
