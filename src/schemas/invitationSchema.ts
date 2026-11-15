import { z } from "zod";

function isPasswordWithinBcryptLimit(password: string) {
    return Buffer.byteLength(password, "utf8") <= 72;
}

const passwordSchema = z.string().trim().min(8, "No mínimo 8 caracteres").refine(isPasswordWithinBcryptLimit, "A senha deve ter no máximo 72 bytes");

export const acceptInvitationSchema = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/, "Token inválido"),
    password: passwordSchema,
    confirmPassword: passwordSchema
}).strict().refine((data) => data.password === data.confirmPassword, {
    message: "As senhas devem ser iguais",
    path: ["confirmPassword"]
});