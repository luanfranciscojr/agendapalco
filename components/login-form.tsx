"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || "Falha na autenticação.");
  }

  return json;
}

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLogin() {
    startTransition(async () => {
      try {
        setFeedback(null);
        await postJson("/api/auth/login", { username, password });
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha no login.");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8 sm:px-6">
      <section className="hero-panel brand-frame w-full rounded-[2.2rem] border border-[var(--line)] p-6 shadow-[0_30px_80px_rgba(24,54,56,0.12)] sm:p-8">
        <div className="mx-auto flex w-full max-w-[220px] justify-center rounded-[1.5rem] border border-[var(--line)] bg-white/92 p-3 shadow-[0_16px_34px_rgba(24,54,56,0.08)]">
          <Image
            src="/brand/nibtb.webp"
            alt="Nova Igreja Batista Tabernáculo"
            width={220}
            height={114}
            priority
            className="h-auto w-full"
          />
        </div>

        <div className="mt-6 inline-flex rounded-full border border-[var(--line)] bg-white/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-strong)]">
          Acesso ao sistema
        </div>

        <div className="mt-5">
          <h1 className="font-display text-5xl leading-none text-[var(--ink)]">
            Agendamento do palco
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
            Entre com seu usuário e senha.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Usuário</span>
            <input
              className="input-base"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Digite seu usuário"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Senha</span>
            <input
              type="password"
              className="input-base"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
            />
          </label>

          {feedback ? (
            <p className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
              {feedback}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleLogin}
            disabled={isPending || !username.trim() || !password.trim()}
            className="button-primary mt-2 w-full justify-center py-4"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </section>
    </div>
  );
}
