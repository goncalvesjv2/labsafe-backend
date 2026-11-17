import { setupUserAccessIntegration } from "./helpers/setupUserAccessIntegration";
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

    describe("Cargo, status e acesso", () => {
        const access = setupUserAccessIntegration(context);

        test("Admin que virou aluno não pode acessar rota administrativa com o token antigo", async () => {
            const accessBefore = await app.inject({
                method: "GET",
                url: "/api/users",
                headers: { authorization: `Bearer ${access.adminToken}` }
            });
            expect(accessBefore.statusCode).toBe(200);

            // Outro admin altera o cargo de quem já está conectado.
            const changeRole = await app.inject({
                method: "PATCH",
                url: `/api/users/${access.admin.id}`,
                headers: { authorization: `Bearer ${context.token}` },
                payload: { name: access.admin.name, email: access.admin.email, role: UserRole.ALUNO }
            });
            expect(changeRole.statusCode).toBe(200);
            const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: access.admin.id } });
            expect(savedUser.role).toBe(user_role.Aluno_a_);

            const accessAfter = await app.inject({
                method: "GET",
                url: "/api/users",
                headers: { authorization: `Bearer ${access.adminToken}` }
            });
            expect(accessAfter.statusCode).toBe(403);
            expect(accessAfter.json().message).toBe("Acesso não autorizado");
        });
    });
});
