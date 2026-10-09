import { db } from "@/lib/db";
import Link from "next/link";
import ReaderActions from "./reader-actions";

export const dynamic = "force-dynamic";

type Message = { body: string; expires_at: string; acknowledged_at: string | null; kept_at: string | null; destroyed_at: string | null };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let record: Message | null = null;
  let unavailable = false;
  const now = new Date().toISOString();
  try {
    if (/^[0-9a-f-]{36}$/.test(id)) {
      await db.prepare("UPDATE messages SET body = '' WHERE id = ? AND expires_at <= ? AND body <> ''").bind(id, now).run();
      record = await db.prepare("SELECT body, expires_at, acknowledged_at, kept_at, destroyed_at FROM messages WHERE id = ?").bind(id).first<Message>();
    }
  } catch { unavailable = true; }
  const active = record && record.expires_at > now && !record.destroyed_at;
  return <main className="message-view"><div className="message-view-card">
    <span className="eyebrow">FOH DESK / MESSAGE</span>
    {record && active ? <>
      <h1>A message for you</h1>
      <p className="message-body">{record.body}</p>
      <div className="message-expiry">Available until {new Date(record.expires_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
      <ReaderActions id={id} expiresAt={record.expires_at} acknowledged={Boolean(record.acknowledged_at)} kept={Boolean(record.kept_at)} />
    </> : <>
      <h1>Message unavailable</h1>
      <p>{unavailable ? "The message could not be loaded. Please try again." : record?.destroyed_at ? "The reader destroyed this message." : "This link has expired or the message cannot be found."}</p>
    </>}
    <Link className="back-link" href="/">Back to FOH desk</Link>
  </div></main>;
}
