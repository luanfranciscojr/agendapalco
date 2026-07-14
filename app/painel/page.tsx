import { getPublicPanelData } from "@/lib/service";

import { PublicPanelClient } from "./public-panel-client";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const data = await getPublicPanelData();

  return <PublicPanelClient data={data} />;
}
