import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { UserRole } from "../../../utils/user";
import { setupQuestionIntegration } from "./helpers/setupQuestionIntegration";

describe("Testes de integração de questões", () => {
    const context = setupQuestionIntegration();

    test("deve rejeitar todas as rotas sem token", async () => {
        const list = await app.inject({
            method: "GET",
            url: "/api/questions"
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1"
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions"
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions"
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1"
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1"
        });

        expect(list.statusCode).toBe(401);
        expect(byId.statusCode).toBe(401);
        expect(byQuiz.statusCode).toBe(401);
        expect(post.statusCode).toBe(401);
        expect(patch.statusCode).toBe(401);
        expect(remove.statusCode).toBe(401);
    });

    test("deve rejeitar um token inválido em todas as rotas", async () => {
        const token = "token-invalido";
        const list = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(list.statusCode).toBe(401);
        expect(byId.statusCode).toBe(401);
        expect(byQuiz.statusCode).toBe(401);
        expect(post.statusCode).toBe(401);
        expect(patch.statusCode).toBe(401);
        expect(remove.statusCode).toBe(401);
    });

    test("deve rejeitar um token expirado em todas as rotas", async () => {
        const token = app.jwt.sign({ sub: context.teacherId, role: UserRole.PROFESSOR }, { expiresIn: -1 });
        const list = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(list.statusCode).toBe(401);
        expect(byId.statusCode).toBe(401);
        expect(byQuiz.statusCode).toBe(401);
        expect(post.statusCode).toBe(401);
        expect(patch.statusCode).toBe(401);
        expect(remove.statusCode).toBe(401);
    });
});
