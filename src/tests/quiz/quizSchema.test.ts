import { describe, test, expect } from "@jest/globals";
import { quizSchema } from "../../schemas/quizSchema";

describe("Validação de cadastro e atualização de quiz", () => {
    test("deve aceitar um ID de conteúdo inteiro e positivo", () => {
        expect(quizSchema.parse({ contentId: 1 })).toEqual({ contentId: 1 });
    });

    test.each([
        ["ausente", {}],
        ["undefined", { contentId: undefined }],
        ["null", { contentId: null }],
        ["texto numérico", { contentId: "1" }],
        ["booleano", { contentId: true }],
        ["zero", { contentId: 0 }],
        ["negativo", { contentId: -1 }],
        ["decimal", { contentId: 1.5 }],
        ["NaN", { contentId: NaN }],
        ["infinito", { contentId: Infinity }]
    ])("deve rejeitar contentId %s", (_name, input) => {
        const result = quizSchema.safeParse(input);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["contentId"]);
    });

    test("deve remover campos que não pertencem ao cadastro", () => {
        expect(quizSchema.parse({ contentId: 1, id: 99, teacherId: 20 }))
            .toEqual({ contentId: 1 });
    });

    test("deve rejeitar um corpo nulo", () => {
        expect(quizSchema.safeParse(null).success).toBe(false);
    });
});
