import { z } from "zod";

export const questionSchema = z.object({
    quizId: z.number().int("O ID do quiz deve ser um número inteiro").positive("O ID do quiz deve ser maior que zero"),
    statement: z.string().trim().min(1, "O enunciado é obrigatório")
});

export const updateQuestionSchema = z.object({
    statement: z.string().trim().min(1, "O enunciado é obrigatório")
});
