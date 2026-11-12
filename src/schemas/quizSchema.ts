import { z } from "zod";

export const quizSchema = z.object({
    contentId: z.number().int("O ID do conteúdo deve ser um número inteiro").positive("O ID do conteúdo deve ser maior que zero")
});
