import { z } from "zod";

export const alternativeSchema = z.array(z.object({
    questionId: z.number().int("O ID da questão deve ser um número inteiro").positive("O ID da questão deve ser maior que zero"),
    text: z.string().trim().min(1, "O texto da alternativa é obrigatório"),
    correct: z.boolean()
})).min(1, "Informe as alternativas da questão").max(4, "A questão pode ter no máximo 4 alternativas");

export const updateAlternativeSchema = z.object({
    text: z.string().trim().min(1, "O texto da alternativa é obrigatório")
});
