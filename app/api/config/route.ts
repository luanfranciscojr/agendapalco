import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getDashboardData, updateSystemConfig, AppError } from "@/lib/service";
import { updateConfigSchema } from "@/lib/validators";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Apenas o admin pode ver essa configuração." }, { status: 403 });
    }

    const data = await getDashboardData(currentUser);
    return NextResponse.json({
      maxRequestsPerMinistryPerWeek: data.maxRequestsPerMinistryPerWeek,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao carregar configuração." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Apenas o admin pode alterar essa configuração." }, { status: 403 });
    }

    const json = await request.json();
    const input = updateConfigSchema.parse(json);
    const updated = await updateSystemConfig(input.maxRequestsPerMinistryPerWeek);

    return NextResponse.json({
      maxRequestsPerMinistryPerWeek: updated.value,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 422 });
    }

    return NextResponse.json(
      { error: "Falha ao atualizar configuração." },
      { status: 500 },
    );
  }
}
