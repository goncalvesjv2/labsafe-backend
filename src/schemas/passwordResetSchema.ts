import { z } from "zod";

export const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido"))
}).strict();
