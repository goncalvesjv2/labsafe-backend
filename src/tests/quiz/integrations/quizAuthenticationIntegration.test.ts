import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { UserRole } from "../../../utils/user";
import { setupQuizIntegration } from "./helpers/setupQuizIntegration";

describe("Testes de integração do quiz", () => {
    const context = setupQuizIntegration();

    test("deve rejeitar todas as rotas sem token", async () => {
        const totalBefore = await context.countQuizzes();
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes"
        });
        expect(listResponse.statusCode).toBe(401);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1"
        });
        expect(byIdResponse.statusCode).toBe(401);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1"
        });
        expect(removeResponse.statusCode).toBe(401);
        expect(await context.countQuizzes()).toBe(totalBefore);
    }, 30000);

    test("deve rejeitar um token inválido em todas as rotas", async () => {
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: "Bearer token-invalido" }
        });
        expect(listResponse.statusCode).toBe(401);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: "Bearer token-invalido" }
        });
        expect(byIdResponse.statusCode).toBe(401);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: "Bearer token-invalido" },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: "Bearer token-invalido" },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: "Bearer token-invalido" }
        });
        expect(removeResponse.statusCode).toBe(401);
    }, 30000);

    test("deve rejeitar um token expirado em todas as rotas", async () => {
        const expiredToken = app.jwt.sign({ sub: context.teacherId, role: UserRole.PROFESSOR }, { expiresIn: -1 });
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${expiredToken}` }
        });
        expect(listResponse.statusCode).toBe(401);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${expiredToken}` }
        });
        expect(byIdResponse.statusCode).toBe(401);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${expiredToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${expiredToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${expiredToken}` }
        });
        expect(removeResponse.statusCode).toBe(401);
    }, 30000);

    test("deve rejeitar o token de um usuário excluído", async () => {
        const user = await prisma.usuario.create({
            data: { name: "Aluno excluído", email: context.deletedUserEmail, senha: context.passwordHash, role: user_role.Aluno_a_ }
        });
        const oldToken = await context.login(context.deletedUserEmail);
        await prisma.logs.deleteMany({ where: { user_id: user.id } });
        await prisma.usuario.delete({ where: { id: user.id } });
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(listResponse.statusCode).toBe(401);
        expect(listResponse.json().message).toBe("Usuário não encontrado");
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(byIdResponse.statusCode).toBe(401);
        expect(byIdResponse.json().message).toBe("Usuário não encontrado");
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        expect(postResponse.json().message).toBe("Usuário não encontrado");
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        expect(patchResponse.json().message).toBe("Usuário não encontrado");
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(removeResponse.statusCode).toBe(401);
        expect(removeResponse.json().message).toBe("Usuário não encontrado");
    }, 30000);

    test("deve bloquear o token antigo de aluno após mudança para administrador", async () => {
        const user = await prisma.usuario.create({
            data: { name: "Aluno com perfil alterado", email: context.changedRoleEmail, senha: context.passwordHash, role: user_role.Aluno_a_ }
        });
        const oldToken = await context.login(context.changedRoleEmail);
        await prisma.usuario.update({ where: { id: user.id }, data: { role: user_role.Admin } });
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(listResponse.statusCode).toBe(403);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(byIdResponse.statusCode).toBe(403);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(403);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(403);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(removeResponse.statusCode).toBe(403);
    }, 30000);
});
