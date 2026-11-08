import { z } from "zod";

export const attemptSchema = z.object({
    quizId: z.number().int("O ID do quiz deve ser um número inteiro").positive("O ID do quiz deve ser maior que zero"),
    answers: z.array(z.object({
        questionId: z.number().int("O ID da questão deve ser um número inteiro").positive("O ID da questão deve ser maior que zero"),
        alternativeId: z.number().int("O ID da alternativa deve ser um número inteiro").positive("O ID da alternativa deve ser maior que zero")
    })).min(1, "Informe ao menos uma resposta").max(10, "O quiz pode ter no máximo 10 respostas")
});