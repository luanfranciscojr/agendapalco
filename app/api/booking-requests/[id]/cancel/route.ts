import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { AppError, cancelBookingRequest } from "@/lib/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await context.params;
    const updated = await cancelBookingRequest(currentUser, id);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Falha ao cancelar agendamento." },
      { status: 500 },
    );
  }
}
