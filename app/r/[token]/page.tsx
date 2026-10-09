import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Receipt = { created_at: string; expires_at: string; acknowledged_at: string | null; kept_at: string | null; destroyed_at: string | null };
const when = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let receipt: Receipt | null = null;
  let unavailable = false;
  try {
    if (/^[0-9a-f-]{36}$/.test(token)) {
      await db.prepare("UPDATE messages SET body = '' WHERE receipt_token = ? AND expires_at <= ? AND body <> ''").bind(token, new Date().toISOString()).run();
      receipt = await db.prepare("SELECT created_at, expires_at, acknowledged_at, kept_at, destroyed_at FROM messages WHERE receipt_token = ?").bind(token).first<Receipt>();
    }
  } catch { unavailable = true; }
  const status = receipt?.destroyed_at ? "Destroyed now"
    : receipt && receipt.expires_at <= new Date().toISOString() ? "Expired"
    : receipt?.kept_at ? "Left available until expiry"
    : "Available";
  return <main className="message-view"><div className="message-view-card">
    <span className="eyebrow">FOH DESK / SENDER RECEIPT</span>
    <h1>Message status</h1>
    {receipt ? <>
      <div className="receipt-status"><span>Status</span><strong>{status}</strong></div>
      <div className="receipt-status"><span>Read acknowledgment</span><strong>{receipt.acknowledged_at ? `Acknowledged ${when(receipt.acknowledged_at)}` : "Not acknowledged yet"}</strong></div>
      <div className="receipt-status"><span>Original 24-hour deadline</span><strong>{when(receipt.expires_at)}</strong></div>
      <p className="receipt-note">Refresh this page to check for updates. Keep this receipt link private.</p>
    </> : <p>{unavailable ? "The receipt could not be loaded. Please try again." : "This receipt link is invalid."}</p>}
    <Link className="back-link" href="/">Back to FOH desk</Link>
  </div></main>;
}
