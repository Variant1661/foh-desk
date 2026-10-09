import { NextResponse } from "next/server";
import { authenticate, COOKIE_NAME, createSession, isAccount, SESSION_SECONDS } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { name?: unknown; code?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!isAccount(body?.name) || typeof body.code !== "string") {
    return NextResponse.json({ error: "Choose an account and enter its four-digit code." }, { status: 400 });
  }
  try {
    const result = authenticate(body.name, body.code);
    if (result === "unconfigured") return NextResponse.json({ error: "Access codes have not been configured on the server." }, { status: 503 });
    if (result === "limited") return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    if (result === "invalid") return NextResponse.json({ error: "Incorrect access code." }, { status: 401 });
    const response = NextResponse.json({ name: body.name }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(COOKIE_NAME, createSession(body.name), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      maxAge: SESSION_SECONDS, path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Login is unavailable. Please try again." }, { status: 503 });
  }
}
