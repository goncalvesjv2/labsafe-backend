import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuestionIntegration } from "./helpers/setupQuestionIntegration";

describe("Testes de integração de questões", () => {
    const context = setupQuestionIntegration();

    test("deve rejeitar dados inválidos no cadastro e na atualização", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const invalidBodies = [
            {},
            { quizId: "1", statement: "Pergunta" },
            { quizId: 0, statement: "Pergunta" },
            { quizId: -1, statement: "Pergunta" },
            { quizId: 1.5, statement: "Pergunta" },
            { quizId: null, statement: "Pergunta" },
            { quizId: quiz.id, statement: "" },
            { quizId: quiz.id, statement: "   " },
            { quizId: quiz.id, statement: 123 }
        ];

        for (const body of invalidBodies) {
            const post = await app.inject({
                method: "POST",
                url: "/api/questions",
                headers: { authorization: `Bearer ${context.teacherToken}` },
                payload: body
            });
            expect(post.statusCode).toBe(400);
            expect(post.json().message).toBe("Dados inválidos");
        }

        const invalidUpdates = [{}, { quizId: quiz.id }, { statement: "" }, { statement: "   " }, { statement: 123 }, { statement: null }];

        for (const body of invalidUpdates) {
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/questions/${question.id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` },
                payload: body
            });
            expect(patch.statusCode).toBe(400);
            expect(patch.json().message).toBe("Dados inválidos");
        }
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
    });

    test("deve rejeitar IDs inválidos nas consultas, edição e exclusão", async () => {
        for (const id of ["0", "-1", "1.5", "abc", "Infinity"]) {
            const get = await app.inject({
                method: "GET",
                url: `/api/questions/${id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` }
            });
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/questions/${id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` }
            });
            const remove = await app.inject({
                method: "DELETE",
                url: `/api/questions/${id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` }
            });
            const byQuiz = await app.inject({
                method: "GET",
                url: `/api/quizzes/${id}/questions`,
                headers: { authorization: `Bearer ${context.teacherToken}` }
            });

            expect(get.statusCode).toBe(400);
            expect(patch.statusCode).toBe(400);
            expect(remove.statusCode).toBe(400);
            expect(byQuiz.statusCode).toBe(400);
            expect(get.json().message).toBe("ID inválido");
            expect(patch.json().message).toBe("ID inválido");
            expect(remove.json().message).toBe("ID inválido");
            expect(byQuiz.json().message).toBe("ID inválido");
        }
    });

    test("deve tratar consulta, edição e exclusão de uma questão inexistente", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        await prisma.question.delete({ where: { id: question.id } });
        const get = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { statement: "Nova pergunta" }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        expect(get.statusCode).toBe(404);
        expect(patch.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(get.json().message).toBe("Questão não encontrada");
        expect(patch.json().message).toBe("Questão não encontrada");
        expect(remove.json().message).toBe("Questão não encontrada");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
    });

    test("deve rejeitar consulta e cadastro para um quiz inexistente", async () => {
        const missingQuiz = await context.createQuiz();
        await prisma.quiz.delete({ where: { id: missingQuiz.id } });
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const get = await app.inject({
            method: "GET",
            url: `/api/quizzes/${missingQuiz.id}/questions`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: missingQuiz.id, statement: "Pergunta" }
        });
        expect(get.statusCode).toBe(404);
        expect(post.statusCode).toBe(400);
        expect(get.json().message).toBe("Quiz não encontrado");
        expect(post.json().message).toBe("Quiz não encontrado");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
    });
});
