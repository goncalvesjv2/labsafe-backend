import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido")),
    password: z.string().trim().min(1, "A senha é obrigatória")
});
