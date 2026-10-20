import { z } from "zod";
import { UserRole } from "../utils/user";

export const userSchema = z.object({
    name: z.string().trim().min(3, "No mínimo 3 caracteres"),
    email: z.email("Informe um e-mail válido"),
    password: z.string().min(8, "No mínimo 8 caracteres"),
    role: z.enum(UserRole)
});