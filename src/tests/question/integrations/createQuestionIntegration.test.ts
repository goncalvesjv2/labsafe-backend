import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuestionIntegration } from "./helpers/setupQuestionIntegration";

describe("Testes de integração de questões", () => {
    const context = setupQuestionIntegration();

    test("deve cadastrar a primeira questão, remover espaços e registrar o log", async () => {
        const quiz = await context.createQuiz();
        const response = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: {
                quizId: quiz.id,
                statement: "  Quando utilizar luvas?  ",
                id: 999,
                teacherId: context.otherTeacherId
            }
        });

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({ id: expect.any(Number), quizId: quiz.id, statement: "Quando utilizar luvas?" });
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: body.id } });
        expect(savedQuestion.quiz_id).toBe(quiz.id);
        expect(savedQuestion.statement).toBe("Quando utilizar luvas?");
        const logs = await prisma.logs.findMany({
            where: { user_id: context.teacherId, action: "CADASTRO_QUESTAO", description: { contains: `questão de ID ${body.id} no quiz` } }
        });
        expect(logs).toHaveLength(1);
    });

    test("deve permitir cadastrar a décima questão", async () => {
        const quiz = await context.createQuiz();
        await context.createQuestions(quiz.id, 9);
        const response = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: quiz.id, statement: "Décima pergunta" }
        });
        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({ id: expect.any(Number), quizId: quiz.id, statement: "Décima pergunta" });
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(10);
    });

    test("deve impedir cadastrar a décima primeira questão sem registrar sucesso", async () => {
        const quiz = await context.createQuiz();
        await context.createQuestions(quiz.id, 10);
        const response = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: quiz.id, statement: "Outra pergunta" }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("O quiz pode ter no máximo 10 questões");
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(10);
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "CADASTRO_QUESTAO", description: { endsWith: `no quiz de ID ${quiz.id}` } }
        })).toBe(0);
    });

    test("deve exigir quiz e enunciado no cadastro", async () => {
        const quiz = await context.createQuiz();
        const withoutQuiz = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { statement: "Pergunta" }
        });
        const withoutStatement = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: quiz.id }
        });

        expect(withoutQuiz.statusCode).toBe(400);
        expect(withoutStatement.statusCode).toBe(400);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(0);
    });
});
