import { z } from "zod";

import { SLOT_END_HOUR, SLOT_START_HOUR } from "@/lib/constants";

const slotKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/, "Horário inválido.");

export const createBookingRequestSchema = z.object({
  ministryId: z.string().min(1, "Ministério obrigatório."),
  slotKeys: z.array(slotKeySchema).min(1, "Selecione ao menos um horário."),
  submissionMode: z.enum(["pending", "approved"]).default("pending"),
  reviewNote: z.string().max(240).optional().default(""),
});

export const reviewBookingRequestSchema = z.object({
  approvedSlotKeys: z.array(slotKeySchema),
  reviewNote: z.string().max(240).optional().default(""),
});

export const updateConfigSchema = z.object({
  maxRequestsPerMinistryPerWeek: z
    .number()
    .int()
    .min(1)
    .max(10),
});

export const updateProfileSchema = z.object({
  whatsappPhone: z
    .string()
    .trim()
    .min(10, "Informe um WhatsApp válido com DDD.")
    .max(20, "WhatsApp muito longo."),
});

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z
      .string()
      .min(4, "A nova senha deve ter ao menos 4 caracteres.")
      .max(80, "A nova senha é muito longa."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    message: "A confirmação da senha não confere.",
    path: ["confirmPassword"],
  });

export const availabilityQuerySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function validateHour(hour: number) {
  return hour >= SLOT_START_HOUR && hour < SLOT_END_HOUR;
}
