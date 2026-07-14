import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { AppError, updateOwnProfile } from "@/lib/service";
import { updateProfileSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const json = await request.json();
    const input = updateProfileSchema.parse(json);
    const updated = await updateOwnProfile(currentUser, input);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 422 });
    }

    return NextResponse.json(
      { error: "Falha ao atualizar perfil." },
      { status: 500 },
    );
  }
}
