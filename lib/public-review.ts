import { createHmac, timingSafeEqual } from "node:crypto";

import { AppError } from "@/lib/service";

export type PublicReviewAction = "approve" | "reject";

type PublicReviewPayload = {
  requestId: string;
  action: PublicReviewAction;
  exp: number;
};

const DEFAULT_APP_BASE_URL = "http://localhost:3001";
const DEFAULT_TTL_HOURS = 72;

function getSecret() {
  const secret = process.env.PUBLIC_REVIEW_SECRET?.trim();

  if (!secret) {
    throw new AppError("PUBLIC_REVIEW_SECRET não configurado.", 500);
  }

  return secret;
}

function getBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || DEFAULT_APP_BASE_URL;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encode(payload: PublicReviewPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decode(token: string): PublicReviewPayload {
  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    throw new AppError("Link inválido.", 400);
  }

  const expectedSignature = sign(encodedPayload);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(encodedSignature);

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new AppError("Link inválido.", 400);
  }

  let payload: PublicReviewPayload;

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new AppError("Link inválido.", 400);
  }

  if (!payload.requestId || !payload.action || !payload.exp) {
    throw new AppError("Link inválido.", 400);
  }

  if (payload.exp < Date.now()) {
    throw new AppError("Link expirado.", 410);
  }

  return payload;
}

export function createPublicReviewToken(
  requestId: string,
  action: PublicReviewAction,
) {
  const payload = encode({
    requestId,
    action,
    exp: Date.now() + DEFAULT_TTL_HOURS * 60 * 60 * 1000,
  });

  return `${payload}.${sign(payload)}`;
}

export function parsePublicReviewToken(token: string) {
  return decode(token);
}

export function buildPublicReviewUrl(
  requestId: string,
  action: PublicReviewAction,
) {
  const url = new URL(buildPublicReviewPath(requestId, action), getBaseUrl());
  return url.toString();
}

export function buildPublicReviewPath(
  requestId: string,
  action: PublicReviewAction,
) {
  const url = new URL(action === "approve" ? "/aprovar" : "/reprovar", "http://local");
  url.searchParams.set("t", createPublicReviewToken(requestId, action));
  return `${url.pathname}${url.search}`;
}

export function getPublicReviewTokenValue(
  requestId: string,
  action: PublicReviewAction,
) {
  return createPublicReviewToken(requestId, action);
}
