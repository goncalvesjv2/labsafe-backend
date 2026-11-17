import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuestionIntegration } from "./helpers/setupQuestionIntegration";

describe("Testes de integração de questões", () => {
    const context = setupQuestionIntegration();

    test("deve atualizar somente o enunciado e registrar o log", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: {
                statement: "  Quando utilizar óculos?  ", teacherId: context.otherTeacherId
            }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Quando utilizar óculos?" });
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
        expect(savedQuestion.statement).toBe("Quando utilizar óculos?");
        expect(savedQuestion.quiz_id).toBe(quiz.id);
        const logs = await prisma.logs.findMany({
            where: { user_id: context.teacherId, action: "ALTERACAO_QUESTAO", description: { contains: `questão de ID ${question.id},` } }
        });
        expect(logs).toHaveLength(1);
    });

    test("deve rejeitar atualização somente com quizId e manter a questão no quiz original", async () => {
        const quiz = await context.createQuiz();
        const targetQuiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        await context.createQuestions(targetQuiz.id, 9);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: targetQuiz.id }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Dados inválidos");
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
        expect(savedQuestion).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.question.count({ where: { quiz_id: targetQuiz.id } })).toBe(9);
    });

    test("deve editar uma questão mantendo o mesmo quiz com dez questões", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        await context.createQuestions(quiz.id, 9);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: {
                quizId: quiz.id, statement: "Nova pergunta"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Nova pergunta" });
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(10);
    });

    test("deve editar somente o enunciado mesmo se receber o ID de outro quiz com dez questões", async () => {
        const quiz = await context.createQuiz();
        const targetQuiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        await context.createQuestions(targetQuiz.id, 10);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: targetQuiz.id, statement: "Novo enunciado" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Novo enunciado" });
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual({ ...question, statement: "Novo enunciado" });
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.question.count({ where: { quiz_id: targetQuiz.id } })).toBe(10);
    });

    test("deve ignorar o ID de um quiz de outro professor ao editar o enunciado", async () => {
        const quiz = await context.createQuiz();
        const targetQuiz = await context.createQuiz(context.otherTeacherId);
        const question = await context.createQuestion(quiz.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: targetQuiz.id, statement: "Novo enunciado" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Novo enunciado" });
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual({ ...question, statement: "Novo enunciado" });
        expect(await prisma.question.count({ where: { quiz_id: targetQuiz.id } })).toBe(0);
    });
});
