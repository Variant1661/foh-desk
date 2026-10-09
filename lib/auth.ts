import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export type Name = "FOH1" | "FOH2" | "FOH3";
export type Account = Name | "ADMIN";
export const COOKIE_NAME = "foh_session";
export const SESSION_SECONDS = 12 * 60 * 60;
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_FAILED_ATTEMPTS = 10;

export function isAccount(value: unknown): value is Account {
  return value === "FOH1" || value === "FOH2" || value === "FOH3" || value === "ADMIN";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function configuredCode(name: Account) {
  const code = process.env[name === "ADMIN" ? "FOH_ADMIN_CODE" : `${name}_CODE`];
  return code && /^\d{4}$/.test(code) ? code : null;
}

export function authenticate(name: Account, code: string): "ok" | "invalid" | "limited" | "unconfigured" {
  const expected = configuredCode(name);
  if (!expected) return "unconfigured";
  const now = Date.now();
  const recent = db.prepare("SELECT COUNT(*) AS count FROM auth_attempts WHERE name = ? AND attempted_at > ?")
    .bind(name, now - ATTEMPT_WINDOW_MS).first<{ count: number }>()?.count ?? 0;
  if (recent >= MAX_FAILED_ATTEMPTS) return "limited";
  const valid = /^\d{4}$/.test(code) && timingSafeEqual(Buffer.from(code), Buffer.from(expected));
  if (!valid) {
    db.prepare("INSERT INTO auth_attempts (name, attempted_at) VALUES (?, ?)").bind(name, now).run();
    return "invalid";
  }
  db.prepare("DELETE FROM auth_attempts WHERE name = ?").bind(name).run();
  return "ok";
}

export function createSession(name: Account) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token_hash, name, expires_at) VALUES (?, ?, ?)")
    .bind(hash(token), name, Date.now() + SESSION_SECONDS * 1000).run();
  return token;
}

export async function sessionName(): Promise<Account | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = db.prepare("SELECT name FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(hash(token), Date.now()).first<{ name: Account }>();
  return row?.name ?? null;
}

export async function endSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash(token)).run();
  }
}
