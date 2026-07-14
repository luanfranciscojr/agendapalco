import Link from "next/link";

import { reviewBookingRequestByPublicLink } from "@/lib/service";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function ReprovarPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const token = params.token;
  let title = "Agendamento reprovado";
  let description = "";

  if (!token) {
    title = "Link inválido";
    description = "O link de reprovação está incompleto.";
    return <PublicReviewResult title={title} description={description} />;
  }

  try {
    const result = await reviewBookingRequestByPublicLink(token);

    if (result.alreadyProcessed) {
      title = "Agendamento já tratado";
      description = `Este agendamento já está como ${result.request.status}.`;
    } else {
      description = `${result.request.ministryName} foi reprovado e o horário foi liberado.`;
    }
  } catch (error) {
    title = "Não foi possível reprovar";
    description = error instanceof Error ? error.message : "Falha ao processar o link.";
  }

  return <PublicReviewResult title={title} description={description} />;
}

function PublicReviewResult({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-8 sm:px-6">
      <section className="hero-panel w-full rounded-[2rem] border border-[var(--line)] p-6 shadow-[0_24px_60px_rgba(24,54,56,0.12)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--danger)]">
          Agendamento do Palco
        </p>
        <h1 className="mt-4 font-display text-4xl text-[var(--ink)]">{title}</h1>
        <p className="mt-3 text-base leading-7 text-[var(--ink-soft)]">{description}</p>
        <Link href="/" className="button-primary mt-8 inline-flex">
          Ir para o sistema
        </Link>
      </section>
    </main>
  );
}
