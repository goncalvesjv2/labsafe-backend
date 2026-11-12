import { describe, expect, test } from "@jest/globals";
import { attemptSchema } from "../../schemas/attemptSchema";

const firstAnswer = { questionId: 1, alternativeId: 11 };
const secondAnswer = { questionId: 2, alternativeId: 21 };
const validInput = { quizId: 5, answers: [firstAnswer, secondAnswer] };
const tenAnswers = [
    firstAnswer,
    secondAnswer,
    { questionId: 3, alternativeId: 31 },
    { questionId: 4, alternativeId: 41 },
    { questionId: 5, alternativeId: 51 },
    { questionId: 6, alternativeId: 61 },
    { questionId: 7, alternativeId: 71 },
    { questionId: 8, alternativeId: 81 },
    { questionId: 9, alternativeId: 91 },
    { questionId: 10, alternativeId: 101 }
];
const invalidIds = [undefined, null, "1", true, false, 0, -1, 1.5, NaN, Infinity];

describe("Validação do envio de tentativas", () => {
    test("deve aceitar um quiz com respostas válidas", () => {
        const result = attemptSchema.parse(validInput);
        expect(result).toEqual(validInput);
    });

    test("deve aceitar uma resposta, que é o mínimo permitido", () => {
        const input = { quizId: 5, answers: [firstAnswer] };
        expect(attemptSchema.parse(input)).toEqual(input);
    });

    test("deve aceitar dez respostas, que é o máximo permitido", () => {
        const input = { quizId: 5, answers: tenAnswers };
        expect(attemptSchema.parse(input)).toEqual(input);
    });

    test("deve rejeitar uma lista vazia de respostas", () => {
        const result = attemptSchema.safeParse({ quizId: 5, answers: [] });
        expect(result.success).toBe(false);
    });

    test("deve rejeitar mais de dez respostas", () => {
        const elevenAnswers = [...tenAnswers, { questionId: 11, alternativeId: 111 }];
        const result = attemptSchema.safeParse({ quizId: 5, answers: elevenAnswers });
        expect(result.success).toBe(false);
    });

    test("deve exigir quizId e answers", () => {
        expect(attemptSchema.safeParse({ answers: [firstAnswer] }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5 }).success).toBe(false);
        expect(attemptSchema.safeParse({}).success).toBe(false);
    });

    test("deve exigir questionId e alternativeId em cada resposta", () => {
        expect(attemptSchema.safeParse({ quizId: 5, answers: [{ alternativeId: 11 }] }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5, answers: [{ questionId: 1 }] }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5, answers: [firstAnswer, {}] }).success).toBe(false);
    });

    test("deve rejeitar quizId que não seja um número inteiro e positivo", () => {
        for (const quizId of invalidIds) {
            const result = attemptSchema.safeParse({ ...validInput, quizId });
            expect(result.success).toBe(false);
        }
    });

    test("deve rejeitar questionId que não seja um número inteiro e positivo", () => {
        for (const questionId of invalidIds) {
            const result = attemptSchema.safeParse({ quizId: 5, answers: [{ questionId, alternativeId: 11 }] });
            expect(result.success).toBe(false);
        }
    });

    test("deve rejeitar alternativeId que não seja um número inteiro e positivo", () => {
        for (const alternativeId of invalidIds) {
            const result = attemptSchema.safeParse({ quizId: 5, answers: [{ questionId: 1, alternativeId }] });
            expect(result.success).toBe(false);
        }
    });

    test("deve rejeitar answers que não seja um array", () => {
        expect(attemptSchema.safeParse({ quizId: 5, answers: "respostas" }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5, answers: firstAnswer }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5, answers: null }).success).toBe(false);
    });

    test("deve rejeitar itens inválidos dentro do array de respostas", () => {
        expect(attemptSchema.safeParse({ quizId: 5, answers: [firstAnswer, null] }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5, answers: [firstAnswer, "resposta"] }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5, answers: [firstAnswer, 1] }).success).toBe(false);
        expect(attemptSchema.safeParse({ quizId: 5, answers: [firstAnswer, []] }).success).toBe(false);
    });

    test("deve rejeitar um corpo que não seja um objeto válido", () => {
        expect(attemptSchema.safeParse(null).success).toBe(false);
        expect(attemptSchema.safeParse(undefined).success).toBe(false);
        expect(attemptSchema.safeParse("tentativa").success).toBe(false);
        expect(attemptSchema.safeParse([validInput]).success).toBe(false);
    });

    test("deve remover campos extras da tentativa", () => {
        const result = attemptSchema.parse({
            ...validInput,
            id: 99,
            studentId: 20,
            score: 100,
            approved: true
        });

        expect(result).toEqual(validInput);
    });

    test("deve remover campos extras de cada resposta", () => {
        const result = attemptSchema.parse({
            quizId: 5,
            answers: [
                { ...firstAnswer, id: 99, attemptId: 10, correct: true },
                { ...secondAnswer, id: 100, attemptId: 10, correct: false }
            ]
        });

        expect(result).toEqual(validInput);
    });
});