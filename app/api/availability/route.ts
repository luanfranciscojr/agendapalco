import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAvailability, AppError } from "@/lib/service";
import { availabilityQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = availabilityQuerySchema.parse({
      weekStart: searchParams.get("weekStart") || undefined,
    });
    const availability = await getAvailability(parsed.weekStart);

    return NextResponse.json(availability);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 422 });
    }

    return NextResponse.json(
      { error: "Falha ao consultar disponibilidade." },
      { status: 500 },
    );
  }
}
