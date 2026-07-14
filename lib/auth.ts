import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const SESSION_COOKIE = "agendamento_palco_session";
const SESSION_TTL_DAYS = 7;

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  whatsappPhone: string | null;
  role: "ministry" | "admin";
  ministryId: string | null;
  ministryName: string | null;
};

function getExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
}

export async function authenticateUser(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { ministry: true },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    whatsappPhone: user.whatsappPhone,
    role: user.role,
    ministryId: user.ministryId,
    ministryName: user.ministry?.name ?? null,
  } satisfies AuthUser;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = getExpiryDate();

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          ministry: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({
        where: { token },
      });
    }
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    whatsappPhone: session.user.whatsappPhone,
    role: session.user.role,
    ministryId: session.user.ministryId,
    ministryName: session.user.ministry?.name ?? null,
  } satisfies AuthUser;
}
