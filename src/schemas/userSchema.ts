import { z } from "zod";
import { UserRole } from "../utils/user";

export const userSchema = z.object({
    name: z.string().trim().min(3, "No mínimo 3 caracteres"),
    email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido")),
    role: z.enum(UserRole)
});

export const updateUserSchema = userSchema.strict();

export const changeUserStatusSchema = z.object({
    ativo: z.boolean()
}).strict();

export type UpdateUser = z.infer<typeof updateUserSchema>;
