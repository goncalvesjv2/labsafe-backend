import { describe, expect, test, jest, beforeAll, beforeEach, afterAll } from "@jest/globals";
import type { IUserResponse } from "../../interfaces/IUser";
import { UserRole } from "../../utils/user";

describe("Testes de integração - autenticação", () => {
    const loginServiceMock = jest.fn<(email: string, password: string) => Promise<{ token: string }>>();
    const findUser = jest.fn<(id: number) => Promise<IUserResponse>>();
    const findAuthenticatedUser = jest.fn<(id: number) => Promise<IUserResponse | null>>();
    const deleteUser = jest.fn<(id: number) => Promise<unknown>>();
    const profile = {
        id: 7,
        name: "Usuário de teste",
        email: "perfil@example.com",
        role: UserRole.ALUNO,
        ativo: true,
    };

    let app: typeof import("../../app").app;

    beforeAll(async () => {
        jest.resetModules();

        jest.doMock("../../services/authService", () => ({
            loginService: loginServiceMock,
        }));
        jest.doMock("../../services/userService", () => ({
            ...jest.requireActual<typeof import("../../services/userService")>("../../services/userService"),
            listUserByIdService: findUser,
        }));
        jest.doMock("../../repositories/userRepository", () => ({
            ...jest.requireActual<typeof import("../../repositories/userRepository")>("../../repositories/userRepository"),
            listUserByIdRepository: findAuthenticatedUser,
            deleteUserRepository: deleteUser,
        }));

        const appModule = await import("../../app");
        app = appModule.app;

        await app.ready();
    });

    beforeEach(() => {
        loginServiceMock.mockReset();
        findUser.mockReset();
        findAuthenticatedUser.mockReset();
        findAuthenticatedUser.mockResolvedValue(profile);
        deleteUser.mockReset();
        deleteUser.mockResolvedValue(profile);
    });

    afterAll(async () => {
        try {
            if (app) {
                await app.close();
            }
        } finally {
            jest.dontMock("../../services/authService");
            jest.dontMock("../../services/userService");
            jest.dontMock("../../repositories/userRepository");
        }
    });

    describe("Login", () => {
        test("deve retornar 200 ao realizar login com sucesso", async () => {
            loginServiceMock.mockResolvedValue({
                token: "token-de-teste",
            });

            const response = await app.inject({
                method: "POST",
                url: "/auth/login",
                payload: {
                    email: "  JOAO.TESTE@EXAMPLE.COM  ",
                    password: "  Senha123!  ",
                },
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                token: "token-de-teste",
            });

            expect(loginServiceMock).toHaveBeenCalledWith(
                "joao.teste@example.com",
                "Senha123!"
            );
        });

        test("Login rejeita e-mail ou senha inválidos sem chamar a service", async () => {
            const email = "joao.teste@example.com";
            const password = "Senha123!";
            const invalidBodies = [
                {},
                { email },
                { password },
                { email: "email-invalido", password },
                { email: "   ", password },
                { email, password: "   " },
                { email: 123, password },
                { email, password: 123 }
            ];

            for (const payload of invalidBodies) {
                const response = await app.inject({ method: "POST", url: "/auth/login", payload });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Dados inválidos");
                expect(response.json().errors).toEqual(expect.any(Array));
                expect(loginServiceMock).not.toHaveBeenCalled();
            }
        });

        test("Status 401 não autorizado", async () => {
            loginServiceMock.mockRejectedValue(
                new Error("E-mail ou senha inválidos")
            );

            const response = await app.inject({
                method: 'POST',
                url: "/auth/login",
                payload: {
                    email: "joaovictor@email.com",
                    password: "incorretPassword",
                }
            });

            expect(response.statusCode).toBe(401);
            expect(response.json()).toHaveProperty("message", "E-mail ou senha inválidos");
        });
    });

    describe("Exclusão da própria conta", () => {
        test.each([UserRole.PROFESSOR, UserRole.ALUNO])("permite que exclua a própria conta apenas com o token", async (role) => {
            findAuthenticatedUser.mockResolvedValue({ ...profile, role });
            const token = app.jwt.sign({ sub: profile.id, role });

            const response = await app.inject({
                method: "DELETE", url: "/auth/me",
                headers: { authorization: `Bearer ${token}` }
            });

            expect(response.statusCode).toBe(204);
            expect(response.body).toBe("");
            expect(deleteUser).toHaveBeenCalledTimes(1);
            expect(deleteUser).toHaveBeenCalledWith(profile.id);
        });

        test("bloqueia o administrador mesmo que o token declare o cargo de aluno", async () => {
            findAuthenticatedUser.mockResolvedValue({ ...profile, role: UserRole.ADMIN });
            const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO });

            const response = await app.inject({
                method: "DELETE", url: "/auth/me",
                headers: { authorization: `Bearer ${token}` }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Você não pode excluir sua própria conta");
            expect(deleteUser).not.toHaveBeenCalled();
        });

        test("rejeita requisições sem token, com token inválido ou expirado", async () => {
            const expired = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO }, { expiresIn: -1 });
            for (const authorization of [undefined, "Bearer invalido", `Bearer ${expired}`]) {
                const response = await app.inject({
                    method: "DELETE", url: "/auth/me",
                    headers: authorization ? { authorization } : {}
                });
                expect(response.statusCode).toBe(401);
            }
            expect(deleteUser).not.toHaveBeenCalled();
        });

        test("rejeita usuários inativos ou inexistentes", async () => {
            const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO });
            for (const user of [null, { ...profile, ativo: false }]) {
                findAuthenticatedUser.mockResolvedValue(user);
                const response = await app.inject({
                    method: "DELETE", url: "/auth/me",
                    headers: { authorization: `Bearer ${token}` }
                });
                expect(response.statusCode).toBe(401);
            }
            expect(deleteUser).not.toHaveBeenCalled();
        });

        test("usa o ID do token mesmo quando outro ID é informado no corpo ou na query", async () => {
            const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO });
            const response = await app.inject({
                method: "DELETE", url: "/auth/me?id=999",
                headers: { authorization: `Bearer ${token}` },
                payload: { id: 999 }
            });

            expect(response.statusCode).toBe(204);
            expect(deleteUser).toHaveBeenCalledWith(profile.id);
        });

        test("o token deixa de permitir acesso depois que a conta é excluída", async () => {
            const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO });
            deleteUser.mockImplementationOnce(async () => {
                findAuthenticatedUser.mockResolvedValue(null);
                return profile;
            });
            const headers = { authorization: `Bearer ${token}` };

            expect((await app.inject({ method: "DELETE", url: "/auth/me", headers })).statusCode).toBe(204);
            expect((await app.inject({ method: "GET", url: "/auth/me", headers })).statusCode).toBe(401);
            expect((await app.inject({ method: "DELETE", url: "/auth/me", headers })).statusCode).toBe(401);
            expect(deleteUser).toHaveBeenCalledTimes(1);
        });
    });

    describe("Consulta do próprio perfil", () => {
        test.each([UserRole.ADMIN, UserRole.PROFESSOR, UserRole.ALUNO])("retorna apenas os dados do usuário autenticado para %s", async (role) => {
            const user = { ...profile, role, senha: "nao-expor", password: "nao-expor" };
            findUser.mockResolvedValue(user);
            const token = app.jwt.sign({ sub: profile.id, role });
            const response = await app.inject({
                method: "GET",
                url: "/auth/me?id=999",
                headers: { authorization: `Bearer ${token}` },
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ ...profile, role });
            expect(findUser).toHaveBeenCalledTimes(1);
            expect(findUser).toHaveBeenCalledWith(profile.id);
            expect(response.json()).not.toHaveProperty("senha");
            expect(response.json()).not.toHaveProperty("password");
        });

        test("rejeita uma requisição sem token", async () => {
            const response = await app.inject({ method: "GET", url: "/auth/me" });
            expect(response.statusCode).toBe(401);
            expect(findUser).not.toHaveBeenCalled();
        });

        test("rejeita um token inválido", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/auth/me",
                headers: { authorization: "Bearer invalido" },
            });
            expect(response.statusCode).toBe(401);
            expect(findUser).not.toHaveBeenCalled();
        });

        test("rejeita um token expirado", async () => {
            const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO }, { expiresIn: -1 });
            const response = await app.inject({
                method: "GET",
                url: "/auth/me",
                headers: { authorization: `Bearer ${token}` },
            });
            expect(response.statusCode).toBe(401);
            expect(findUser).not.toHaveBeenCalled();
        });

        test("rejeita a autenticação se o usuário não existe mais", async () => {
            findAuthenticatedUser.mockResolvedValue(null);
            const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO });
            const response = await app.inject({
                method: "GET",
                url: "/auth/me",
                headers: { authorization: `Bearer ${token}` },
            });
            expect(response.statusCode).toBe(401);
            expect(findUser).not.toHaveBeenCalled();
        });
    });
});
