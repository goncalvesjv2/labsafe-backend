import { describe, expect, test } from "@jest/globals";
import { UserRole } from "../../../utils/user";
import { setupAuthIntegration } from "./helpers/setupAuthIntegration";

describe("Testes de integração - autenticação", () => {
    const context = setupAuthIntegration();

    describe("Exclusão da própria conta", () => {
        test.each([UserRole.PROFESSOR, UserRole.ALUNO])("permite que exclua a própria conta apenas com o token", async (role) => {
            context.findAuthenticatedUser.mockResolvedValue({ ...context.profile, role });
            const token = context.app.jwt.sign({ sub: context.profile.id, role });

            const response = await context.app.inject({
                method: "DELETE", url: "/auth/me",
                headers: { authorization: `Bearer ${token}` }
            });

            expect(response.statusCode).toBe(204);
            expect(response.body).toBe("");
            expect(context.deleteUser).toHaveBeenCalledTimes(1);
            expect(context.deleteUser).toHaveBeenCalledWith(context.profile.id);
        });

        test("bloqueia o administrador mesmo que o token declare o cargo de aluno", async () => {
            context.findAuthenticatedUser.mockResolvedValue({ ...context.profile, role: UserRole.ADMIN });
            const token = context.app.jwt.sign({ sub: context.profile.id, role: UserRole.ALUNO });

            const response = await context.app.inject({
                method: "DELETE", url: "/auth/me",
                headers: { authorization: `Bearer ${token}` }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Você não pode excluir sua própria conta");
            expect(context.deleteUser).not.toHaveBeenCalled();
        });

        test("rejeita requisições sem token, com token inválido ou expirado", async () => {
            const expired = context.app.jwt.sign({ sub: context.profile.id, role: UserRole.ALUNO }, { expiresIn: -1 });
            for (const authorization of [undefined, "Bearer invalido", `Bearer ${expired}`]) {
                const response = await context.app.inject({
                    method: "DELETE", url: "/auth/me",
                    headers: authorization ? { authorization } : {}
                });
                expect(response.statusCode).toBe(401);
            }
            expect(context.deleteUser).not.toHaveBeenCalled();
        });

        test("rejeita usuários inativos ou inexistentes", async () => {
            const token = context.app.jwt.sign({ sub: context.profile.id, role: UserRole.ALUNO });
            for (const user of [null, { ...context.profile, ativo: false }]) {
                context.findAuthenticatedUser.mockResolvedValue(user);
                const response = await context.app.inject({
                    method: "DELETE", url: "/auth/me",
                    headers: { authorization: `Bearer ${token}` }
                });
                expect(response.statusCode).toBe(401);
            }
            expect(context.deleteUser).not.toHaveBeenCalled();
        });

        test("usa o ID do token mesmo quando outro ID é informado no corpo ou na query", async () => {
            const token = context.app.jwt.sign({ sub: context.profile.id, role: UserRole.ALUNO });
            const response = await context.app.inject({
                method: "DELETE", url: "/auth/me?id=999",
                headers: { authorization: `Bearer ${token}` },
                payload: { id: 999 }
            });

            expect(response.statusCode).toBe(204);
            expect(context.deleteUser).toHaveBeenCalledWith(context.profile.id);
        });

        test("o token deixa de permitir acesso depois que a conta é excluída", async () => {
            const token = context.app.jwt.sign({ sub: context.profile.id, role: UserRole.ALUNO });
            context.deleteUser.mockImplementationOnce(async () => {
                context.findAuthenticatedUser.mockResolvedValue(null);
                return context.profile;
            });
            const headers = { authorization: `Bearer ${token}` };

            expect((await context.app.inject({ method: "DELETE", url: "/auth/me", headers })).statusCode).toBe(204);
            expect((await context.app.inject({ method: "GET", url: "/auth/me", headers })).statusCode).toBe(401);
            expect((await context.app.inject({ method: "DELETE", url: "/auth/me", headers })).statusCode).toBe(401);
            expect(context.deleteUser).toHaveBeenCalledTimes(1);
        });
    });
});
