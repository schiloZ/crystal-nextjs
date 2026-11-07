import bcrypt from "bcryptjs";
import { z } from "zod";

const BCRYPT_COST = 12;

export const PASSWORD_RULE_MESSAGE =
  "Le mot de passe doit contenir au moins 12 caractères, dont une lettre et un chiffre.";

/** Règle commune à toute création ou modification de mot de passe. */
export const passwordSchema = z
  .string()
  .min(12, PASSWORD_RULE_MESSAGE)
  .max(100)
  .regex(/[A-Za-z]/, PASSWORD_RULE_MESSAGE)
  .regex(/\d/, PASSWORD_RULE_MESSAGE);

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}
