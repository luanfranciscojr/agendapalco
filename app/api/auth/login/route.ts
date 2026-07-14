import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { authenticateUser, createSession } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = loginSchema.parse(json);
    const user = await authenticateUser(input.username, input.password);

    if (!user) {
      return NextResponse.json(
        { error: "Login ou senha inválidos." },
        { status: 401 },
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      user,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 422 });
    }

    return NextResponse.json({ error: "Falha no login." }, { status: 500 });
  }
}
