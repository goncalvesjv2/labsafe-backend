import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve rejeitar dados inválidos sem salvar tentativas ou respostas", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const invalidBodies = [
            { quizId: String(quiz.id), answers: correctAnswers },
            { quizId: quiz.id, answers: [] },
            { quizId: quiz.id, answers: [{ questionId: correctAnswers[0].questionId, alternativeId: "1" }] },
            { quizId: quiz.id }
        ];

        for (const payload of invalidBodies) {
            const response = await app.inject({
                method: "POST",
                url: "/api/attempts",
                headers: { authorization: `Bearer ${context.studentToken}` },
                payload
            });
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Dados inválidos");
            expect(response.json().errors.length).toBeGreaterThan(0);
        }

        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio para um quiz inexistente", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        await prisma.quiz.delete({ where: { id: quiz.id } });
        const response = await context.sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Quiz não encontrado");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio para um quiz sem questões", async () => {
        const { quiz } = await context.createQuiz(0);
        const response = await context.sendAttempt(quiz.id, [{ questionId: 1, alternativeId: 1 }]);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("O quiz deve ter entre 1 e 10 questões para ser respondido");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio para um quiz com onze questões", async () => {
        const { quiz, correctAnswers } = await context.createQuiz(11);
        const response = await context.sendAttempt(quiz.id, correctAnswers.slice(0, 10));

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("O quiz deve ter entre 1 e 10 questões para ser respondido");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio quando faltam respostas", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const response = await context.sendAttempt(quiz.id, [correctAnswers[0]]);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Responda todas as questões do quiz");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir respostas repetidas para a mesma questão", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const response = await context.sendAttempt(quiz.id, [correctAnswers[0], correctAnswers[0], correctAnswers[2]]);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Envie exatamente uma resposta para cada questão do quiz");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir respostas para questões de outro quiz", async () => {
        const firstQuiz = await context.createQuiz();
        const secondQuiz = await context.createQuiz();
        const answers = [secondQuiz.correctAnswers[0], firstQuiz.correctAnswers[1], firstQuiz.correctAnswers[2]];
        const response = await context.sendAttempt(firstQuiz.quiz.id, answers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Envie exatamente uma resposta para cada questão do quiz");
        await context.expectNoAttempts(firstQuiz.quiz.id);
        await context.expectNoAttempts(secondQuiz.quiz.id);
    });

    test("deve impedir uma alternativa que pertence a outra questão", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const answers = [
            { questionId: correctAnswers[0].questionId, alternativeId: correctAnswers[1].alternativeId },
            correctAnswers[1],
            correctAnswers[2]
        ];
        const response = await context.sendAttempt(quiz.id, answers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A alternativa selecionada não pertence à questão");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir uma questão com menos de duas alternativas", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz(1);
        await prisma.alternative.delete({ where: { id: incorrectAnswers[0].alternativeId } });
        const response = await context.sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Cada questão deve ter entre 2 e 4 alternativas");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir uma questão com mais de quatro alternativas", async () => {
        const { quiz, correctAnswers } = await context.createQuiz(1);
        const questionId = correctAnswers[0].questionId;
        await prisma.alternative.createMany({
            data: [
                { question_id: questionId, text: "Terceira alternativa", correct: false },
                { question_id: questionId, text: "Quarta alternativa", correct: false },
                { question_id: questionId, text: "Quinta alternativa", correct: false }
            ]
        });
        const response = await context.sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Cada questão deve ter entre 2 e 4 alternativas");
        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir questões sem correta ou com mais de uma correta", async () => {
        const { quiz, correctAnswers } = await context.createQuiz(1);

        for (const correct of [false, true]) {
            await prisma.alternative.updateMany({ where: { question_id: correctAnswers[0].questionId }, data: { correct } });
            const response = await context.sendAttempt(quiz.id, correctAnswers);

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Cada questão deve ter exatamente 1 alternativa correta");
        }

        await context.expectNoAttempts(quiz.id);
    });
});
