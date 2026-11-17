import { setupUserAccessIntegration } from "./helpers/setupUserAccessIntegration";
import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
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

        test("Usuário ativo pode fazer login com a senha correta", async () => {
            const response = await access.loginUser();
            expect(response.statusCode).toBe(200);
            expect(response.json().token).toEqual(expect.any(String));
            expect(await prisma.logs.count({ where: { user_id: access.user.id, action: "LOGIN" } })).toBe(1);
        });

        test("Usuário sem senha definida não pode fazer login", async () => {
            await prisma.usuario.update({ where: { id: access.user.id }, data: { senha: null } });
            const response = await access.loginUser();
            expect(response.statusCode).toBe(401);
            expect(response.json().message).toBe("E-mail ou senha inválidos");
            expect(response.json()).not.toHaveProperty("token");
            expect(await prisma.logs.count({ where: { user_id: access.user.id, action: "LOGIN" } })).toBe(0);
        });

        test("Usuário ativo não pode fazer login com a senha incorreta", async () => {
            const response = await app.inject({
                method: "POST", url: "/auth/login", payload: { email: access.user.email, password: "SenhaIncorreta!" }
            });

            expect(response.statusCode).toBe(401);
            expect(response.json()).not.toHaveProperty("token");
            expect(await prisma.logs.count({ where: { user_id: access.user.id, action: "LOGIN" } })).toBe(0);
        });

        test("Usuário desativado não pode fazer login mesmo com a senha correta", async () => {
            expect((await access.changeStatus(false)).statusCode).toBe(200);
            const response = await access.loginUser();
            expect(response.statusCode).toBe(401);
            expect(response.json().message).toBe("E-mail ou senha inválidos");
            expect(response.json()).not.toHaveProperty("token");
            expect(await prisma.logs.count({ where: { user_id: access.user.id, action: "LOGIN" } })).toBe(0);
        });
    });
});
