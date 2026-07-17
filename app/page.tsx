import { getCurrentUser } from "@/lib/auth";
import { StageSchedulerApp } from "@/components/stage-scheduler-app";
import { getDashboardData } from "@/lib/service";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { validateWeekStart } from "@/lib/rules";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ semana?: string | string[] }>;
};

export default async function Home({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <LoginForm />;
  }

  const params = await searchParams;
  const selectedWeek = typeof params.semana === "string" ? params.semana : undefined;
  if (selectedWeek && !validateWeekStart(selectedWeek)) {
    redirect("/");
  }
  const data = await getDashboardData(currentUser, selectedWeek);
  return <StageSchedulerApp data={data} />;
}
