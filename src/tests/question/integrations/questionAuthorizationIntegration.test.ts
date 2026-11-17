import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuestionIntegration } from "./helpers/setupQuestionIntegration";

describe("Testes de integração de questões", () => {
    const context = setupQuestionIntegration();

    test("deve impedir outro professor de cadastrar, editar ou excluir questões do quiz", async () => {
        const quiz = await context.createQuiz();
        const ownQuizOfOtherTeacher = await context.createQuiz(context.otherTeacherId);
        const question = await context.createQuestion(quiz.id);
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.otherTeacherToken}` },
            payload: { quizId: quiz.id, statement: "Pergunta" }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` },
            payload: {
                quizId: ownQuizOfOtherTeacher.id, statement: "Pergunta alterada"
            }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` }
        });

        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(post.json().message).toBe("Você pode somente criar questões nos seus próprios quizzes");
        expect(patch.json().message).toBe("Você pode somente atualizar suas próprias questões");
        expect(remove.json().message).toBe("Você só pode excluir suas próprias questões");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.question.count({ where: { quiz_id: ownQuizOfOtherTeacher.id } })).toBe(0);
    });

    test("deve verificar o criador do quiz mesmo se o professor do conteúdo mudar", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        await prisma.conteudo.update({ where: { id: quiz.conteudo_id }, data: { professor_id: context.otherTeacherId } });

        const denied = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` },
            payload: { statement: "Alteração indevida" }
        });
        expect(denied.statusCode).toBe(400);
        expect(denied.json().message).toBe("Você pode somente atualizar suas próprias questões");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);

        const allowed = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { statement: "Alteração do criador" }
        });
        expect(allowed.statusCode).toBe(200);
        expect(allowed.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Alteração do criador" });
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
        expect(savedQuestion.statement).toBe("Alteração do criador");
    });

    test("deve bloquear o administrador em todas as rotas e registrar as tentativas", async () => {
        const list = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });

        expect(list.statusCode).toBe(403);
        expect(byId.statusCode).toBe(403);
        expect(byQuiz.statusCode).toBe(403);
        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        const logs = await prisma.logs.findMany({ where: { user_id: context.adminId, action: "FALHA_AUTORIZACAO" } });
        expect(logs).toHaveLength(6);
    });

    test("deve impedir que o aluno cadastre, edite ou exclua questões", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${context.studentToken}` },
            payload: { quizId: quiz.id, statement: "Pergunta" }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` },
            payload: { statement: "Nova pergunta" }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });

        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.logs.count({ where: { user_id: context.studentId, action: "FALHA_AUTORIZACAO" } })).toBe(3);
    });
});
