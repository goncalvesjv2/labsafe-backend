import { describe, expect, test } from "@jest/globals";
import { alternativeSchema, updateAlternativeSchema } from "../../schemas/alternativeSchema";

const correctAlternative = { questionId: 1, text: "Óculos de proteção", correct: true };
const incorrectAlternative = { questionId: 1, text: "Luvas", correct: false };

describe("Validação de cadastro de alternativas", () => {
    test("deve aceitar um array de alternativas e remover espaços do texto", () => {
        const result = alternativeSchema.parse([
            { questionId: 1, text: "  Óculos de proteção  ", correct: true },
            incorrectAlternative
        ]);

        expect(result).toEqual([correctAlternative, incorrectAlternative]);
    });

    test("deve aceitar uma alternativa na requisição", () => {
        const result = alternativeSchema.parse([incorrectAlternative]);
        expect(result).toEqual([incorrectAlternative]);
    });

    test("deve aceitar três ou quatro alternativas na requisição", () => {
        const thirdAlternative = { questionId: 1, text: "Jaleco", correct: false };
        const fourthAlternative = { questionId: 1, text: "Máscara", correct: false };
        const threeAlternatives = [correctAlternative, incorrectAlternative, thirdAlternative];
        const fourAlternatives = [...threeAlternatives, fourthAlternative];
        expect(alternativeSchema.parse(threeAlternatives)).toEqual(threeAlternatives);
        expect(alternativeSchema.parse(fourAlternatives)).toEqual(fourAlternatives);
    });

    test("deve rejeitar um array vazio", () => {
        const result = alternativeSchema.safeParse([]);
        expect(result.success).toBe(false);
    });

    test("deve rejeitar mais de quatro alternativas na requisição", () => {
        const result = alternativeSchema.safeParse([
            correctAlternative,
            incorrectAlternative,
            { questionId: 1, text: "Jaleco", correct: false },
            { questionId: 1, text: "Máscara", correct: false },
            { questionId: 1, text: "Calçado fechado", correct: false }
        ]);
        expect(result.success).toBe(false);
    });

    test("deve rejeitar um corpo que não seja um array", () => {
        expect(alternativeSchema.safeParse(correctAlternative).success).toBe(false);
        expect(alternativeSchema.safeParse("alternativas").success).toBe(false);
        expect(alternativeSchema.safeParse(null).success).toBe(false);
    });

    test("deve exigir questionId, text e correct em cada alternativa", () => {
        expect(alternativeSchema.safeParse([{ text: "Luvas", correct: false }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ questionId: 1, correct: false }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ questionId: 1, text: "Luvas" }]).success).toBe(false);
    });

    test("deve rejeitar IDs que não sejam números inteiros e positivos", () => {
        expect(alternativeSchema.safeParse([{ ...correctAlternative, questionId: "1" }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, questionId: 0 }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, questionId: -1 }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, questionId: 1.5 }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, questionId: null }]).success).toBe(false);
    });

    test("deve rejeitar texto vazio ou com somente espaços", () => {
        expect(alternativeSchema.safeParse([{ ...correctAlternative, text: "" }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, text: "   " }]).success).toBe(false);
    });

    test("deve rejeitar valores de text que não sejam strings", () => {
        expect(alternativeSchema.safeParse([{ ...correctAlternative, text: 123 }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, text: null }]).success).toBe(false);
    });

    test("deve exigir um booleano no campo correct", () => {
        expect(alternativeSchema.parse([correctAlternative])).toEqual([correctAlternative]);
        expect(alternativeSchema.parse([incorrectAlternative])).toEqual([incorrectAlternative]);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, correct: "true" }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, correct: "false" }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, correct: 1 }]).success).toBe(false);
        expect(alternativeSchema.safeParse([{ ...correctAlternative, correct: null }]).success).toBe(false);
    });

    test("deve remover campos extras de cada alternativa", () => {
        const result = alternativeSchema.parse([
            { ...correctAlternative, id: 99, teacherId: 20 },
            { ...incorrectAlternative, id: 100, teacherId: 20 }
        ]);

        expect(result).toEqual([correctAlternative, incorrectAlternative]);
    });
});

describe("Validação de atualização de alternativas", () => {
    test("deve aceitar o texto e remover espaços das pontas", () => {
        const result = updateAlternativeSchema.parse({ text: "  Luvas de proteção  " });
        expect(result).toEqual({ text: "Luvas de proteção" });
    });

    test("deve rejeitar uma atualização sem texto", () => {
        expect(updateAlternativeSchema.safeParse({}).success).toBe(false);
    });

    test("deve rejeitar texto vazio ou com somente espaços", () => {
        expect(updateAlternativeSchema.safeParse({ text: "" }).success).toBe(false);
        expect(updateAlternativeSchema.safeParse({ text: "   " }).success).toBe(false);
    });

    test("deve rejeitar valores de text que não sejam strings", () => {
        expect(updateAlternativeSchema.safeParse({ text: 123 }).success).toBe(false);
        expect(updateAlternativeSchema.safeParse({ text: null }).success).toBe(false);
    });

    test("deve manter somente o texto e remover os demais campos", () => {
        const result = updateAlternativeSchema.parse({
            text: "Luvas de proteção",
            id: 99,
            questionId: 2,
            correct: true,
            teacherId: 20
        });

        expect(result).toEqual({ text: "Luvas de proteção" });
    });

    test("deve rejeitar uma atualização somente com correct ou questionId", () => {
        expect(updateAlternativeSchema.safeParse({ correct: true }).success).toBe(false);
        expect(updateAlternativeSchema.safeParse({ questionId: 2 }).success).toBe(false);
    });

    test("deve rejeitar um corpo nulo ou um array na atualização", () => {
        expect(updateAlternativeSchema.safeParse(null).success).toBe(false);
        expect(updateAlternativeSchema.safeParse([{ text: "Luvas" }]).success).toBe(false);
    });
});