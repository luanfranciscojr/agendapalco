import { formatDatePtBr, hourLabel } from "@/lib/time";

const SMSBARATO_BASE_URL =
  process.env.SMSBARATO_BASE_URL ?? "https://sistema81.smsbarato.com.br";
const SMSBARATO_API_KEY = process.env.SMSBARATO_API_KEY ?? "";
const SMSBARATO_TEMPLATE_APPROVED =
  process.env.SMSBARATO_TEMPLATE_APPROVED ?? "nibtb_confirmado1";
const SMSBARATO_TEMPLATE_REJECTED =
  process.env.SMSBARATO_TEMPLATE_REJECTED ?? "nibtb_reprovado1";
const SMSBARATO_TEMPLATE_PENDING_ADMIN =
  process.env.SMSBARATO_TEMPLATE_PENDING_ADMIN ?? "nibtb_pending1";

type WhatsAppTemplateName = "approved" | "rejected" | "pending_admin";

type WhatsAppMessageInput = {
  recipientName: string;
  phone: string;
  dateKey: string;
  hour: number;
  ministryName?: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function canSendWhatsApp() {
  return Boolean(SMSBARATO_API_KEY);
}

function getTemplateName(template: WhatsAppTemplateName) {
  if (template === "approved") {
    return SMSBARATO_TEMPLATE_APPROVED;
  }

  if (template === "rejected") {
    return SMSBARATO_TEMPLATE_REJECTED;
  }

  return SMSBARATO_TEMPLATE_PENDING_ADMIN;
}

function getTemplateParams(
  template: WhatsAppTemplateName,
  input: WhatsAppMessageInput,
) {
  if (template === "pending_admin") {
    return [
      input.ministryName ?? input.recipientName,
      formatDatePtBr(input.dateKey),
      hourLabel(input.hour),
    ];
  }

  return [
    input.recipientName,
    formatDatePtBr(input.dateKey),
    hourLabel(input.hour),
  ];
}

export function getWhatsAppConfigStatus() {
  return {
    enabled: canSendWhatsApp(),
    baseUrl: SMSBARATO_BASE_URL,
    templates: {
      approved: SMSBARATO_TEMPLATE_APPROVED,
      rejected: SMSBARATO_TEMPLATE_REJECTED,
      pendingAdmin: SMSBARATO_TEMPLATE_PENDING_ADMIN,
    },
  };
}

export async function sendWhatsAppTemplate(
  template: WhatsAppTemplateName,
  input: WhatsAppMessageInput,
) {
  if (!canSendWhatsApp()) {
    return { skipped: true as const, reason: "missing_api_key" as const };
  }

  const dest = normalizePhone(input.phone);

  if (!dest) {
    return { skipped: true as const, reason: "missing_phone" as const };
  }

  const url = new URL("/sendwa", SMSBARATO_BASE_URL);
  url.searchParams.set("chave", SMSBARATO_API_KEY);
  url.searchParams.set("dest", dest);
  url.searchParams.set("template", getTemplateName(template));

  for (const param of getTemplateParams(template, input)) {
    url.searchParams.append("prm[]", param);
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Falha ao enviar WhatsApp (${response.status}): ${bodyText || "sem detalhe"}`,
    );
  }

  return {
    skipped: false as const,
    status: response.status,
    bodyText,
  };
}
