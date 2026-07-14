import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { AppError, reviewBookingRequest } from "@/lib/service";
import { reviewBookingRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Apenas admin pode aprovar." }, { status: 403 });
    }

    const { id } = await context.params;
    const json = await request.json();
    const input = reviewBookingRequestSchema.parse(json);
    const updated = await reviewBookingRequest(id, input);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 422 });
    }

    return NextResponse.json(
      { error: "Falha ao revisar pedido." },
      { status: 500 },
    );
  }
}
