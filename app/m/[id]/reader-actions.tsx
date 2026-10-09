"use client";

import { useEffect, useState } from "react";

export default function ReaderActions({ id, expiresAt, acknowledged, kept }: { id: string; expiresAt: string; acknowledged: boolean; kept: boolean }) {
  const [hasAcknowledged, setHasAcknowledged] = useState(acknowledged);
  const [hasKept, setHasKept] = useState(kept);
  const [destroyed, setDestroyed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) { window.location.reload(); return; }
    const timer = window.setTimeout(() => window.location.reload(), remaining + 50);
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  async function choose(action: "acknowledge" | "keep" | "destroy") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/messages/${id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save your choice.");
      if (action === "acknowledge") setHasAcknowledged(true);
      if (action === "keep") setHasKept(true);
      if (action === "destroy") { setDestroyed(true); window.location.reload(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your choice."); }
    finally { setBusy(false); }
  }

  if (destroyed) return <div className="reader-done" role="status"><strong>Message destroyed.</strong><span>The sender can see your acknowledgment if you made one.</span></div>;
  return <div className="reader-actions">
    <h2>What would you like to do?</h2>
    <p>You can acknowledge that you have read it before choosing what happens next.</p>
    <button type="button" className="secondary" onClick={() => choose("acknowledge")} disabled={busy || hasAcknowledged}>{hasAcknowledged ? "Read acknowledged" : "Acknowledge I've read it"}</button>
    <div className="reader-choices">
      <button type="button" className="secondary" onClick={() => choose("keep")} disabled={busy || hasKept}>{hasKept ? "Leaving until expiry" : "Leave for 24 hours"}</button>
      <button type="button" className="destroy-button" onClick={() => choose("destroy")} disabled={busy}>Destroy now</button>
    </div>
    {hasKept && <p className="choice-note" role="status">This message remains available until its original 24-hour deadline. You can still destroy it now.</p>}
    {error && <p className="choice-error" role="alert">{error}</p>}
  </div>;
}
