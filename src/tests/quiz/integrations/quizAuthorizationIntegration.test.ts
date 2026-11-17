import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuizIntegration } from "./helpers/setupQuizIntegration";

describe("Testes de integração do quiz", () => {
    const context = setupQuizIntegration();

    test("deve bloquear o administrador em todas as rotas e registrar as tentativas", async () => {
        const totalBefore = await context.countQuizzes();
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        expect(listResponse.statusCode).toBe(403);
        const listBody = listResponse.json();
        expect(listBody.message).toBe("Somente professores e alunos podem acessar os quizzes");
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        expect(byIdResponse.statusCode).toBe(403);
        const byIdBody = byIdResponse.json();
        expect(byIdBody.message).toBe("Somente professores e alunos podem acessar os quizzes");
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${context.adminToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(403);
        const postBody = postResponse.json();
        expect(postBody.message).toBe("Somente professores podem executar esta ação");
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${context.adminToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(403);
        const patchBody = patchResponse.json();
        expect(patchBody.message).toBe("Somente professores podem executar esta ação");
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        expect(removeResponse.statusCode).toBe(403);
        const removeBody = removeResponse.json();
        expect(removeBody.message).toBe("Somente professores podem executar esta ação");
        expect(await context.countQuizzes()).toBe(totalBefore);
        const logs = await prisma.logs.findMany({ where: { user_id: context.adminId, action: "FALHA_AUTORIZACAO" } });
        expect(logs).toHaveLength(5);
    }, 30000);

    test("deve impedir que o aluno cadastre, atualize ou exclua quizzes", async () => {
        const { quiz } = await context.createQuizFixture();
        const targetContent = await context.createContent();
        const totalBefore = await context.countQuizzes();
        const post = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${context.studentToken}` },
            payload: { contentId: targetContent.id }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` },
            payload: { contentId: targetContent.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await context.countQuizzes()).toBe(totalBefore);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: targetContent.id } })).toBeNull();
        expect(await prisma.logs.count({ where: { user_id: context.studentId, action: "FALHA_AUTORIZACAO" } })).toBe(3);
    }, 30000);

    test("deve impedir a edição e a exclusão do quiz de outro professor", async () => {
        const { quiz } = await context.createQuizFixture(context.otherTeacherId);
        const targetContent = await context.createContent();
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: targetContent.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        expect(patch.statusCode).toBe(400);
        expect(patch.json().message).toBe("Você pode somente atualizar seus próprios quizzes");
        expect(remove.statusCode).toBe(500);
        expect(remove.json().message).toBe("Você só pode excluir seus próprios quizzes");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: targetContent.id } })).toBeNull();
    }, 30000);

    test("deve usar o criador do quiz para autorizar edição e exclusão", async () => {
        const { quiz, content } = await context.createQuizFixture();
        const savedQuiz = await prisma.quiz.update({
            where: { id: quiz.id },
            data: { professor_id: context.otherTeacherId }
        });

        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: content.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(patch.statusCode).toBe(400);
        expect(patch.json().message).toBe("Você pode somente atualizar seus próprios quizzes");
        expect(remove.statusCode).toBe(500);
        expect(remove.json().message).toBe("Você só pode excluir seus próprios quizzes");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(savedQuiz);
    }, 30000);
});
