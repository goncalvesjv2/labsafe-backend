import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { setupQuestionIntegration } from "./helpers/setupQuestionIntegration";

describe("Testes de integração de questões", () => {
    const context = setupQuestionIntegration();

    test("deve permitir que professor e aluno listem todas as questões", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        const expectedQuestion = { id: question.id, quizId: quiz.id, statement: question.statement };
        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toContainEqual(expectedQuestion);
        expect(studentResponse.json()).toContainEqual(expectedQuestion);
    });

    test("deve permitir que professor, outro professor e aluno consultem uma questão", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const otherTeacherResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        const expectedQuestion = { id: question.id, quizId: quiz.id, statement: question.statement };
        expect(teacherResponse.statusCode).toBe(200);
        expect(otherTeacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toEqual(expectedQuestion);
        expect(otherTeacherResponse.json()).toEqual(expectedQuestion);
        expect(studentResponse.json()).toEqual(expectedQuestion);
    });

    test("deve listar somente as questões do quiz informado em ordem de ID", async () => {
        const quiz = await context.createQuiz();
        const otherQuiz = await context.createQuiz();
        const first = await context.createQuestion(quiz.id);
        await context.createQuestion(otherQuiz.id);
        const second = await context.createQuestion(quiz.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/questions`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/questions`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        const expectedQuestions = [
            { id: first.id, quizId: quiz.id, statement: first.statement },
            { id: second.id, quizId: quiz.id, statement: second.statement }
        ];
        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toEqual(expectedQuestions);
        expect(studentResponse.json()).toEqual(expectedQuestions);
    });

    test("deve retornar uma lista vazia para um quiz sem questões", async () => {
        const quiz = await context.createQuiz();
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/questions`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });
});
