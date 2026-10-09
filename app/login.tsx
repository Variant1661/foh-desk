"use client";

import { FormEvent, useState } from "react";

type Name = "FOH1" | "FOH2" | "FOH3" | "ADMIN";

export default function Login() {
  const [name, setName] = useState<Name>("FOH1");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
      setCode("");
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <form className="login-card" onSubmit={submit}>
      <div className="brand"><span className="brand-mark">F</span><span>FOH desk</span></div>
      <span className="eyebrow">TEAM ACCESS</span>
      <h1>Welcome back.</h1>
      <p>Choose your account and enter your access code.</p>
      <label htmlFor="login-name">Account</label>
      <select id="login-name" value={name} onChange={(event) => { setName(event.target.value as Name); setCode(""); setError(""); }}>
        <option value="FOH1">FOH1</option><option value="FOH2">FOH2</option><option value="FOH3">FOH3</option><option value="ADMIN">Admin</option>
      </select>
      <label htmlFor="login-code">Access code</label>
      <input id="login-code" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off"
        value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} required />
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy || code.length !== 4}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </main>;
}
