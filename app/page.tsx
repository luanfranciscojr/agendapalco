import { getCurrentUser } from "@/lib/auth";
import { StageSchedulerApp } from "@/components/stage-scheduler-app";
import { getDashboardData } from "@/lib/service";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <LoginForm />;
  }

  const data = await getDashboardData(currentUser);
  return <StageSchedulerApp data={data} />;
}
