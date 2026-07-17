import { getPublicPanelData } from "@/lib/service";
import { redirect } from "next/navigation";
import { validateWeekStart } from "@/lib/rules";

import { PublicPanelClient } from "./public-panel-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ semana?: string | string[] }>;
};

export default async function PainelPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedWeek = typeof params.semana === "string" ? params.semana : undefined;
  if (selectedWeek && !validateWeekStart(selectedWeek)) {
    redirect("/painel");
  }
  const data = await getPublicPanelData(selectedWeek);

  return <PublicPanelClient data={data} />;
}
