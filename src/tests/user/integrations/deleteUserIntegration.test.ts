import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
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

    test("deve impedir que o administrador exclua a própria conta", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/users/${context.adminId}`,
            headers: { Authorization: `Bearer ${context.token}` }
        });

        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.message).toBe("Você não pode excluir sua própria conta");

        const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: context.adminId } });
        expect(admin.email).toBe(context.adminEmail);
        expect(admin.role).toBe(user_role.Admin);
        expect(admin.ativo).toBe(true);
    }, 30000);

    test("deve excluir um usuário", async () => {
        const user = { name: "Aluno Exclusão", email: context.deleteEmail, role: UserRole.ALUNO };

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
            method: "DELETE",
            url: `/api/users/${createdUser.id}`,
            headers: { Authorization: `Bearer ${context.token}` }
        });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");

        const deletedUser = await prisma.usuario.findUnique({ where: { id: createdUser.id } });
        expect(deletedUser).toBeNull();
    }, 30000);
});
