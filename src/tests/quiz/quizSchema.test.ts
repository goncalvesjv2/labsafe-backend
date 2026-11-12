import { describe, test, expect } from "@jest/globals";
import { quizSchema } from "../../schemas/quizSchema";

describe("Validação de cadastro e atualização de quiz", () => {
    test("deve aceitar um ID de conteúdo inteiro e positivo", () => {
        expect(quizSchema.parse({ contentId: 1 })).toEqual({ contentId: 1 });
    });

    test("deve rejeitar IDs que não sejam números inteiros e positivos", () => {
        const invalidIds = [undefined, null, "1", true, 0, -1, 1.5, NaN, Infinity];

        for (const contentId of invalidIds) {
            const result = quizSchema.safeParse({ contentId });
            expect(result.success).toBe(false);
            expect(result.error?.issues[0].path).toEqual(["contentId"]);
        }
    });

    test("deve exigir o conteúdo no cadastro e na atualização", () => {
        expect(quizSchema.safeParse({}).success).toBe(false);
    });

    test("deve remover campos que não pertencem ao cadastro", () => {
        expect(quizSchema.parse({ contentId: 1, id: 99, teacherId: 20 })).toEqual({ contentId: 1 });
    });

    test("deve rejeitar um corpo nulo", () => {
        expect(quizSchema.safeParse(null).success).toBe(false);
    });
});
