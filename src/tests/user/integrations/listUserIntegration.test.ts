import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { UserRole } from "../../../utils/user";
import { setupUserIntegration } from "./helpers/setupUserIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

jest.mock("../../../services/logService", () => {
    const original = jest.requireActual<typeof import("../../../services/logService")>("../../../services/logService");
    return { ...original, createLogService: jest.fn(original.createLogService) };
});

describe("Teste de integração de usuários", () => {
    const context = setupUserIntegration();

    test("deve listar usuários e encontrar o usuário cadastrado", async () => {
        const user = { name: "Aluno Listagem", email: context.listEmail, role: UserRole.ALUNO };

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();

        const response = await app.inject({
            method: "GET",
            url: "/api/users",
            headers: { Authorization: `Bearer ${context.token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toContainEqual(expect.objectContaining({
            id: createdUser.id,
            name: user.name,
            email: context.listEmail,
            role: user.role
        }));
    }, 30000);

    test("deve consultar um usuário pelo ID", async () => {
        const user = { name: "Aluno Consulta", email: context.idEmail, role: UserRole.ALUNO };
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();
        const response = await app.inject({
            method: "GET",
            url: `/api/users/${createdUser.id}`,
            headers: { Authorization: `Bearer ${context.token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id: createdUser.id,
            name: user.name,
            email: context.idEmail,
            role: user.role
        });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
    }, 30000);

    test("deve retornar erro ao consultar um usuário inexistente", async () => {
        const user = { name: "Aluno Temporário", email: context.missingEmail, role: UserRole.ALUNO };
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();
        const deleteResponse = await app.inject({
            method: "DELETE",
            url: `/api/users/${createdUser.id}`,
            headers: {Authorization: `Bearer ${context.token}`}
        });
        expect(deleteResponse.statusCode).toBe(204);
        const response = await app.inject({
            method: "GET",
            url: `/api/users/${createdUser.id}`,
            headers: {Authorization: `Bearer ${context.token}`}
        });
        expect(response.statusCode).toBe(404);
        const body = response.json();
        expect(body.message).toBe("Usuário não encontrado");
    }, 30000);
});
