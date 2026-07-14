import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createBookingRequest, getDashboardData, AppError } from "@/lib/service";
import { createBookingRequestSchema } from "@/lib/validators";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const data = await getDashboardData(currentUser);
    return NextResponse.json(data.requests);
  } catch {
    return NextResponse.json(
      { error: "Falha ao carregar pedidos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const json = await request.json();
    const input = createBookingRequestSchema.parse(json);
    const created = await createBookingRequest(currentUser, input);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 422 });
    }

    return NextResponse.json(
      { error: "Falha ao criar agendamento." },
      { status: 500 },
    );
  }
}
