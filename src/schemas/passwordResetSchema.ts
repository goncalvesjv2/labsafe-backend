import { z } from "zod";

function isPasswordWithinBcryptLimit(password: string) {
    return Buffer.byteLength(password, "utf8") <= 72;
}

const passwordSchema = z.string().trim().min(8, "No mínimo 8 caracteres").refine(isPasswordWithinBcryptLimit, "A senha deve ter no máximo 72 bytes");

export const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido"))
}).strict();

export const resetPasswordSchema = z.object({
    token: z.string().length(64, "Token inválido").regex(/^[a-f0-9]+$/, "Token inválido"),
    password: passwordSchema,
    confirmPassword: passwordSchema
}).strict().refine((data) => data.password === data.confirmPassword, {
    message: "As senhas devem ser iguais",
    path: ["confirmPassword"]
});
