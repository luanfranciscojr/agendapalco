import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { AppError, updateWeekBookingStatus } from "@/lib/service";
import { updateWeekBookingStatusSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ weekStart: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas a coordenação pode liberar ou bloquear semanas." },
        { status: 403 },
      );
    }

    const { weekStart } = await context.params;
    const input = updateWeekBookingStatusSchema.parse(await request.json());
    const updated = await updateWeekBookingStatus(currentUser, weekStart, input.isOpen);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Informe se a semana deve ser liberada ou bloqueada." }, { status: 422 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Não foi possível atualizar a semana. Tente novamente." },
      { status: 500 },
    );
  }
}
