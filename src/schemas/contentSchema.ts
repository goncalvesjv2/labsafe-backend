import { z } from "zod";

export const contentSchema = z.object({
    title: z.string().trim().min(1, "O título é obrigatório").max(150, "O título deve ter no máximo 150 caracteres"),
    description: z.string().trim().min(1, "A descrição é obrigatória")
});

export const updateSchema = contentSchema.partial().refine((content) => {
    content.title !== undefined || content.description !== undefined, {
        message: "Informe ao menos um campo para atualizar"
    }
});