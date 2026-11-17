import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve impedir outro professor de cadastrar, editar, trocar a correta ou excluir", async () => {
        const question = await context.createQuestion();
        const { correctAlternative, incorrectAlternative } = await context.createAlternatives(question.id);
        await prisma.alternative.create({ data: { question_id: question.id, text: "Jaleco", correct: false } });
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.otherTeacherToken}` },
            payload: [{ questionId: question.id, text: "Máscara", correct: false }]
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` },
            payload: { text: "Alteração indevida" }
        });
        const change = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` }
        });

        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(change.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(post.json().message).toBe("Você pode somente criar alternativas nos seus próprios quizzes");
        expect(patch.json().message).toBe("Você pode somente atualizar alternativas dos seus próprios quizzes");
        expect(change.json().message).toBe("Você pode somente alterar a alternativa correta dos seus próprios quizzes");
        expect(remove.json().message).toBe("Você só pode excluir alternativas dos seus próprios quizzes");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(3);
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual(correctAlternative);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({
            where: { user_id: context.otherTeacherId, action: { in: ["CADASTRO_ALTERNATIVA", "ALTERACAO_ALTERNATIVA", "ALTERACAO_ALTERNATIVA_CORRETA", "EXCLUSAO_ALTERNATIVA"] } }
        })).toBe(0);
    });

    test("deve impedir alterações por alunos e registrar as tentativas", async () => {
        const question = await context.createQuestion();
        const { incorrectAlternative } = await context.createAlternatives(question.id);
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.studentToken}` },
            payload: [{ questionId: question.id, text: "Jaleco", correct: false }]
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` },
            payload: { text: "Alteração indevida" }
        });
        const change = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });

        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(change.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({ where: { user_id: context.studentId, action: "FALHA_AUTORIZACAO" } })).toBe(4);
    });

    test("deve impedir o administrador em todas as rotas", async () => {
        const question = await context.createQuestion();
        const { incorrectAlternative } = await context.createAlternatives(question.id);
        const list = await app.inject({
            method: "GET",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const byQuestion = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.adminToken}` },
            payload: [{ questionId: question.id, text: "Jaleco", correct: false }]
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.adminToken}` },
            payload: { text: "Alteração indevida" }
        });
        const change = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${context.adminToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.adminToken}` }
        });

        expect(list.statusCode).toBe(403);
        expect(byId.statusCode).toBe(403);
        expect(byQuestion.statusCode).toBe(403);
        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(change.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({ where: { user_id: context.adminId, action: "FALHA_AUTORIZACAO" } })).toBe(7);
    });
});
