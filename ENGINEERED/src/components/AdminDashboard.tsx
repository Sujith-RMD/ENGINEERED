"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, RefreshCcw, ShieldAlert, Trash2, Eye, EyeOff } from "lucide-react";

interface Overview {
  day: string;
  activeSessions: { id: string; missionId: string; difficulty: string; createdAt: string }[];
  recentResults: { id: string; shareId: string; missionId: string; difficulty: string; playerName: string | null; score: number; archetypeId: string; createdAt: string }[];
  todayEntries: { id: string; missionId: string; playerName: string | null; score: number; difficulty: string }[];
  missions: { id: string; title: string; icon: string; difficulty: number; enabled: boolean }[];
}

export function AdminDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const body = (await res.json()) as Overview;
      setData(body);
      setAuthed(true);
    } catch {
      setLoginError("Overview unreachable");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function login() {
    setLoginError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      setPasscode("");
      await load();
    } else {
      setLoginError("Invalid passcode");
    }
  }

  async function moderate(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => undefined);
    await load();
  }

  async function toggleMission(id: string, enabled: boolean) {
    const current = data?.missions.filter((m) => (m.id === id ? enabled : m.enabled)).map((m) => m.id) ?? [];
    setBusy(true);
    await fetch("/api/admin/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionIds: current }),
    }).catch(() => undefined);
    await load();
  }

  if (authed === null) {
    return <main className="flex min-h-screen items-center justify-center"><p className="tlabel animate-pulse-soft">CONNECTING…</p></main>;
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="panel brackets w-full max-w-sm p-8">
          <p className="tlabel text-amber">// ORGANIZER ACCESS</p>
          <h1 className="mt-2 flex items-center gap-2 font-mono text-2xl font-bold"><Lock className="h-5 w-5" aria-hidden /> ADMIN</h1>
          <label className="mt-6 block">
            <span className="tlabel">PASSCODE</span>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              className="mt-1 w-full border border-line bg-void px-3 py-3 font-mono tracking-[0.2em]"
              autoFocus
            />
          </label>
          {loginError && <p className="mt-2 text-sm text-danger">{loginError}</p>}
          <button onClick={login} className="panel panel-accent brackets mt-5 w-full py-3 font-mono text-sm font-bold tracking-[0.25em] text-accent">
            UNLOCK
          </button>
          <p className="tlabel mt-4 text-center text-[8px]">SET ADMIN_PASSCODE IN .ENV</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="tlabel">// ORGANIZER CONSOLE — DAY {data?.day ?? "…"}</p>
          <h1 className="mt-1 font-mono text-3xl font-bold tracking-[0.15em]">STALL CONTROL</h1>
        </div>
        <button onClick={load} className="panel flex items-center gap-2 px-4 py-2 font-mono text-xs text-muted hover:text-fg">
          <RefreshCcw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden /> REFRESH
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <p className="tlabel mb-3">ACTIVE SESSIONS ({data?.activeSessions.length ?? 0})</p>
          <ul className="space-y-1.5 font-mono text-xs text-muted">
            {data?.activeSessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 border-b border-line/60 pb-1.5">
                <span className="truncate">{s.missionId} · {s.difficulty}</span>
                <span className="text-dim">{new Date(s.createdAt).toLocaleTimeString()}</span>
              </li>
            ))}
            {data?.activeSessions.length === 0 && <li className="text-dim">No live sessions.</li>}
          </ul>
          <button
            onClick={() => moderate({ op: "purgeStale" })}
            className="panel mt-4 flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-muted hover:text-fg"
          >
            <Trash2 className="h-3 w-3" aria-hidden /> PURGE SESSIONS &gt; 2H OLD
          </button>
        </section>

        <section className="panel p-5">
          <p className="tlabel mb-3">TODAY&apos;S TOP 10</p>
          <ol className="space-y-1 font-mono text-xs">
            {data?.todayEntries.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between gap-2 border-b border-line/60 pb-1">
                <span className="text-dim">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 truncate">{e.playerName ?? "ANON"} · {e.missionId}</span>
                <span className="font-bold text-fg">{e.score}</span>
                <button
                  onClick={() => moderate({ op: "hide", entryId: e.id, hidden: true })}
                  title="Hide entry"
                  className="text-dim hover:text-danger"
                  aria-label={`Hide entry ${e.playerName ?? ""}`}
                >
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
            {data?.todayEntries.length === 0 && <li className="text-dim">No entries today.</li>}
          </ol>
          <button
            onClick={() => data && moderate({ op: "clearDay", day: data.day })}
            className="mt-4 flex items-center gap-2 border border-danger/50 px-3 py-2 font-mono text-[11px] text-danger hover:bg-danger/10"
          >
            <ShieldAlert className="h-3 w-3" aria-hidden /> CLEAR TODAY&apos;S LEADERBOARD
          </button>
        </section>

        <section className="panel p-5">
          <p className="tlabel mb-3">MISSION CONTROL</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data?.missions.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border border-line px-3 py-2">
                <span className="truncate font-mono text-xs">{m.icon} {m.title}</span>
                <button
                  onClick={() => toggleMission(m.id, !m.enabled)}
                  className={`font-mono text-[10px] tracking-[0.15em] ${m.enabled ? "text-good" : "text-danger"}`}
                  aria-pressed={m.enabled}
                >
                  {m.enabled ? <Eye className="h-4 w-4" aria-label="Disable" /> : <EyeOff className="h-4 w-4" aria-label="Enable" />}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <p className="tlabel mb-3">RECENT RESULTS</p>
          <ul className="space-y-1.5 font-mono text-xs text-muted">
            {data?.recentResults.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b border-line/60 pb-1.5">
                <span className="truncate">
                  {r.playerName ?? "ANON"} · {r.missionId} ·{" "}
                  <a href={`/results/${r.shareId}`} className="text-accent hover:underline">{r.shareId}</a>
                </span>
                <span className="font-bold text-fg">{r.score}</span>
              </li>
            ))}
            {data?.recentResults.length === 0 && <li className="text-dim">No results yet.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
