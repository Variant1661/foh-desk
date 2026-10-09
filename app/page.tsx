"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Clock3, Link2, Plus, Send, SquarePen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Name = "FOH1" | "FOH2" | "FOH3";
type Entry = { id: string; name: Name; date: string; timeIn: string; timeOut: string | null };
const names: Name[] = ["FOH1", "FOH2", "FOH3"];
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const nowTime = () => new Date().toTimeString().slice(0, 5);

export default function Home() {
  const [name, setName] = useState<Name>("FOH1");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [receiptLink, setReceiptLink] = useState("");
  const [date, setDate] = useState(today);
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/timesheet?name=${name}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setEntries(((await response.json()) as { entries: Entry[] }).entries);
    } catch { setNotice("Could not load the timesheet. Please try again."); }
  }, [name]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> };
    const context = (document as Document & { modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
    register({ name: "create_message_link", title: "Create message link", description: "Save a message that can be read from a link for 24 hours.", inputSchema: { type: "object", properties: { message: { type: "string", minLength: 1, maxLength: 5000 } }, required: ["message"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, async execute(input) {
      const message = (input as { message?: unknown })?.message;
      if (typeof message !== "string" || !message.trim() || message.length > 5000) throw new Error("Enter a message up to 5,000 characters.");
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = (await response.json()) as { error?: string; id: string; receiptToken: string; expiresAt: string };
      if (!response.ok) throw new Error(data.error || "Could not create the link.");
      const url = `${window.location.origin}/m/${data.id}`; const receiptUrl = `${window.location.origin}/r/${data.receiptToken}`; setLink(url); setReceiptLink(receiptUrl); setNotice("Message and receipt links are ready.");
      return { url, receiptUrl, expiresAt: data.expiresAt };
    } });
    register({ name: "add_timesheet_entry", title: "Add timesheet entry", description: "Add a dated time in and optional time out for FOH1, FOH2, or FOH3.", inputSchema: { type: "object", properties: { name: { type: "string", enum: names }, date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, timeIn: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }, timeOut: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" } }, required: ["name", "date", "timeIn"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, async execute(input) {
      const data = input as { name?: unknown; date?: unknown; timeIn?: unknown; timeOut?: unknown };
      if (!names.includes(data.name as Name) || typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || typeof data.timeIn !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.timeIn) || (data.timeOut !== undefined && (typeof data.timeOut !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.timeOut)))) throw new Error("Invalid timesheet entry.");
      const response = await fetch("/api/timesheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const saved = (await response.json()) as { error?: string; id: string };
      if (!response.ok) throw new Error(saved.error || "Could not add the entry.");
      setName(data.name as Name); setNotice("Entry added."); if (data.name === name) await load();
      return { id: saved.id, name: data.name, date: data.date };
    } });
    return () => lifecycle.abort();
  }, [name, load]);

  async function shareMessage() {
    if (!message.trim()) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = (await response.json()) as { error?: string; id: string; receiptToken: string };
      if (!response.ok) throw new Error(data.error || "Could not create the link.");
      setLink(`${window.location.origin}/m/${data.id}`);
      setReceiptLink(`${window.location.origin}/r/${data.receiptToken}`);
      setMessage("");
      setNotice("Message and receipt links are ready.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create the link."); }
    finally { setBusy(false); }
  }

  async function saveEntry() {
    if (!date || !timeIn) { setNotice("Add a date and time in."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/timesheet", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing, name, date, timeIn, timeOut: timeOut || null }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the entry.");
      setEditing(null); setDate(today()); setTimeIn(""); setTimeOut("");
      setNotice(editing ? "Entry updated." : "Entry added.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the entry."); }
    finally { setBusy(false); }
  }

  async function clockIn() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/timesheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, date: today(), timeIn: nowTime(), timeOut: null }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not clock in.");
      setNotice(`${name} clocked in at ${nowTime()}.`); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not clock in."); }
    finally { setBusy(false); }
  }

  async function clockOut() {
    const open = entries.find((entry) => !entry.timeOut);
    if (!open) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/timesheet", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...open, timeOut: nowTime() }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not clock out.");
      setNotice(`${name} clocked out at ${nowTime()}.`); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not clock out."); }
    finally { setBusy(false); }
  }

  function edit(entry: Entry) { setEditing(entry.id); setDate(entry.date); setTimeIn(entry.timeIn); setTimeOut(entry.timeOut || ""); document.getElementById("manual-entry")?.scrollIntoView({ behavior: "smooth" }); }
  const open = entries.find((entry) => !entry.timeOut);

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">F</span><span>FOH desk</span></div><span className="top-label">Messages & timesheet</span></header>
    <div className="main-grid">
      <section className="panel message-panel" aria-labelledby="messages-title">
        <div className="section-heading"><span className="eyebrow">01 / SHARE</span><h1 id="messages-title">Send a message</h1><p>Share a link that lasts up to 24 hours. The reader can acknowledge it and destroy it sooner.</p></div>
        <label htmlFor="message">Your message</label>
        <textarea id="message" maxLength={5000} placeholder="Write your message here…" value={message} onChange={(e) => setMessage(e.target.value)} rows={7} />
        <div className="under-input"><span>{message.length} / 5,000</span><button className="primary" type="button" onClick={shareMessage} disabled={busy || !message.trim()}><Send size={17} /> Create link</button></div>
        {link && <div className="link-stack"><div className="link-result"><div><span className="eyebrow">SEND THIS MESSAGE LINK</span><a href={link} target="_blank" rel="noreferrer">{link}</a></div><button type="button" onClick={async () => { await navigator.clipboard.writeText(link); setNotice("Message link copied."); }}><Copy size={16} /> Copy</button></div><div className="link-result receipt-link"><div><span className="eyebrow">KEEP THIS RECEIPT LINK</span><a href={receiptLink} target="_blank" rel="noreferrer">{receiptLink}</a><small>Check whether the reader acknowledged or destroyed the message.</small></div><button type="button" onClick={async () => { await navigator.clipboard.writeText(receiptLink); setNotice("Receipt link copied."); }}><Copy size={16} /> Copy</button></div></div>}
        <div className="quiet-note"><Link2 size={17} /> Anyone with the message link can read it while available. Keep the receipt link to yourself.</div>
      </section>

      <section className="panel time-panel" aria-labelledby="timesheet-title">
        <div className="section-heading"><span className="eyebrow">02 / HOURS</span><h2 id="timesheet-title">Timesheet</h2><p>Choose your name to view and record your hours.</p></div>
        <Tabs value={name} onValueChange={(value) => { setName(value as Name); setEntries([]); setEditing(null); setNotice(""); }}><TabsList className="name-tabs">{names.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}</TabsList></Tabs>
        <div className="clock-card"><div><span className="eyebrow">CURRENT STATUS</span><strong>{open ? `Clocked in · ${open.timeIn}` : "Not clocked in"}</strong></div><button className="primary" type="button" onClick={open ? clockOut : clockIn} disabled={busy}><Clock3 size={17} /> {open ? "Clock out" : "Clock in"}</button></div>
        <div id="manual-entry" className="manual-entry"><div className="subheading"><SquarePen size={18}/><h3>{editing ? "Edit entry" : "Add time manually"}</h3></div><div className="entry-fields"><div><label htmlFor="date">Date</label><input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div><label htmlFor="time-in">Time in</label><input id="time-in" type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} /></div><div><label htmlFor="time-out">Time out</label><input id="time-out" type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} /></div></div><div className="entry-actions"><button className="secondary" type="button" onClick={saveEntry} disabled={busy}><Plus size={16}/>{editing ? "Save changes" : "Add entry"}</button>{editing && <button className="text-button" type="button" onClick={() => { setEditing(null); setDate(today()); setTimeIn(""); setTimeOut(""); }}>Cancel</button>}</div></div>
        <div className="records"><div className="records-title"><h3>{name} entries</h3><span>{entries.length} total</span></div>{entries.length === 0 ? <p className="empty">No entries yet. Clock in or add a time above.</p> : <div className="record-list">{entries.map((entry) => <div className="record" key={entry.id}><div><strong>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</strong><span>{entry.timeIn} – {entry.timeOut || "Open"}</span></div><button type="button" onClick={() => edit(entry)} aria-label={`Edit entry for ${entry.date}`}><SquarePen size={17}/></button></div>)}</div>}</div>
      </section>
    </div>
    {notice && <div className="notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
  </main>;
}
