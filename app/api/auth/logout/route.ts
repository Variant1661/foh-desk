import { NextResponse } from "next/server";
import { COOKIE_NAME, endSession } from "@/lib/auth";

export async function POST() {
  await endSession();
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: 0, path: "/",
  });
  return response;
}
