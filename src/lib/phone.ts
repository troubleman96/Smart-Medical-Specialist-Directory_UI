import { z } from "zod";

export function normalizeTzPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, "");
  if (/^\+255\d{9}$/.test(digits)) return digits;
  if (/^255\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+255${digits.slice(1)}`;
  return null;
}

export const tzPhoneSchema = z
  .string()
  .min(1, "Phone required")
  .refine((v) => normalizeTzPhone(v) !== null, {
    message: "Enter a Tanzania number (07XX XXX XXX)",
  })
  .transform((v) => normalizeTzPhone(v)!);
