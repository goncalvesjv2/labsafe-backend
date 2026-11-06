import { describe, expect, test } from "@jest/globals";
import { questionSchema, updateQuestionSchema } from "../../schemas/questionSchema";

describe("Validação de questões", () => {
    test("deve aceitar os dados de cadastro e remover espaços do enunciado", () => {
        const result = questionSchema.parse({ quizId: 1, statement: "  Quando utilizar luvas?  " });
        expect(result).toEqual({ quizId: 1, statement: "Quando utilizar luvas?" });
    });

    test("deve exigir o quiz e o enunciado no cadastro", () => {
        expect(questionSchema.safeParse({ statement: "Quando utilizar luvas?" }).success).toBe(false);
        expect(questionSchema.safeParse({ quizId: 1 }).success).toBe(false);
    });

    test("deve rejeitar IDs que não sejam números inteiros e positivos", () => {
        expect(questionSchema.safeParse({ quizId: "1", statement: "Pergunta" }).success).toBe(false);
        expect(questionSchema.safeParse({ quizId: 0, statement: "Pergunta" }).success).toBe(false);
        expect(questionSchema.safeParse({ quizId: -1, statement: "Pergunta" }).success).toBe(false);
        expect(questionSchema.safeParse({ quizId: 1.5, statement: "Pergunta" }).success).toBe(false);
    });

    test("deve rejeitar enunciados vazios ou que não sejam texto", () => {
        expect(questionSchema.safeParse({ quizId: 1, statement: "" }).success).toBe(false);
        expect(questionSchema.safeParse({ quizId: 1, statement: "   " }).success).toBe(false);
        expect(questionSchema.safeParse({ quizId: 1, statement: 123 }).success).toBe(false);
    });

    test("deve permitir atualizar apenas o enunciado", () => {
        const result = updateQuestionSchema.parse({ statement: "  Nova pergunta  " });
        expect(result).toEqual({ statement: "Nova pergunta" });
    });

    test("deve permitir atualizar apenas o quiz ou os dois campos", () => {
        expect(updateQuestionSchema.parse({ quizId: 2 })).toEqual({ quizId: 2 });
        expect(updateQuestionSchema.parse({ quizId: 2, statement: "Nova pergunta" })).toEqual({ quizId: 2, statement: "Nova pergunta" });
    });

    test("deve rejeitar atualizações sem campos ou com valores inválidos", () => {
        expect(updateQuestionSchema.safeParse({}).success).toBe(false);
        expect(updateQuestionSchema.safeParse({ quizId: 0 }).success).toBe(false);
        expect(updateQuestionSchema.safeParse({ statement: "   " }).success).toBe(false);
        expect(updateQuestionSchema.safeParse({ statement: null }).success).toBe(false);
    });

    test("deve ignorar campos extras e rejeitar uma atualização apenas com eles", () => {
        const result = questionSchema.parse({ quizId: 1, statement: "Pergunta", id: 99, teacherId: 20 });
        expect(result).toEqual({ quizId: 1, statement: "Pergunta" });
        expect(updateQuestionSchema.safeParse({ teacherId: 20 }).success).toBe(false);
    });

    test("deve rejeitar um corpo nulo", () => {
        expect(questionSchema.safeParse(null).success).toBe(false);
        expect(updateQuestionSchema.safeParse(null).success).toBe(false);
    });
});