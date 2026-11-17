import { describe, expect, test } from "@jest/globals";
import { UserRole } from "../../../utils/user";
import { setupAuthIntegration } from "./helpers/setupAuthIntegration";

describe("Testes de integração - autenticação", () => {
    const context = setupAuthIntegration();

    describe("Consulta do próprio perfil", () => {
        test.each([UserRole.ADMIN, UserRole.PROFESSOR, UserRole.ALUNO])("retorna apenas os dados do usuário autenticado para %s", async (role) => {
            const user = { ...context.profile, role, senha: "nao-expor", password: "nao-expor" };
            context.findUser.mockResolvedValue(user);
            const token = context.app.jwt.sign({ sub: context.profile.id, role });
            const response = await context.app.inject({
                method: "GET",
                url: "/auth/me?id=999",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ ...context.profile, role });
            expect(context.findUser).toHaveBeenCalledTimes(1);
            expect(context.findUser).toHaveBeenCalledWith(context.profile.id);
            expect(response.json()).not.toHaveProperty("senha");
            expect(response.json()).not.toHaveProperty("password");
        });

        test("rejeita uma requisição sem token", async () => {
            const response = await context.app.inject({ method: "GET", url: "/auth/me" });
            expect(response.statusCode).toBe(401);
            expect(context.findUser).not.toHaveBeenCalled();
        });

        test("rejeita um token inválido", async () => {
            const response = await context.app.inject({
                method: "GET",
                url: "/auth/me",
                headers: { authorization: "Bearer invalido" },
            });
            expect(response.statusCode).toBe(401);
            expect(context.findUser).not.toHaveBeenCalled();
        });

        test("rejeita um token expirado", async () => {
            const token = context.app.jwt.sign({ sub: context.profile.id, role: UserRole.ALUNO }, { expiresIn: -1 });
            const response = await context.app.inject({
                method: "GET",
                url: "/auth/me",
                headers: { authorization: `Bearer ${token}` },
            });
            expect(response.statusCode).toBe(401);
            expect(context.findUser).not.toHaveBeenCalled();
        });

        test("rejeita a autenticação se o usuário não existe mais", async () => {
            context.findAuthenticatedUser.mockResolvedValue(null);
            const token = context.app.jwt.sign({ sub: context.profile.id, role: UserRole.ALUNO });
            const response = await context.app.inject({
                method: "GET",
                url: "/auth/me",
                headers: { authorization: `Bearer ${token}` },
            });
            expect(response.statusCode).toBe(401);
            expect(context.findUser).not.toHaveBeenCalled();
        });
    });
});
