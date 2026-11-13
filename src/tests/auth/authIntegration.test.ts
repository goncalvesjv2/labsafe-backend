import { describe, expect, test, jest, beforeAll, beforeEach, afterAll } from "@jest/globals";
import type { IUserResponse } from "../../interfaces/IUser";
import { UserRole } from "../../utils/user";

describe("Testes de integração - autenticação", () => {
    const loginServiceMock = jest.fn<(email: string, password: string) => Promise<{ token: string }>>();
    const findUser = jest.fn<(id: number) => Promise<IUserResponse>>();

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

        const appModule = await import("../../app");
        app = appModule.app;

        await app.ready();
    });

    beforeEach(() => {
        loginServiceMock.mockReset();
        findUser.mockReset();
    });

    afterAll(async () => {
        try {
            if (app) {
                await app.close();
            }
        } finally {
            jest.dontMock("../../services/authService");
            jest.dontMock("../../services/userService");
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
                    email: "joao.teste@example.com",
                    password: "Senha123!",
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

    describe("Consulta do próprio perfil", () => {
        const profile = {
            id: 7,
            name: "Usuário de teste",
            email: "perfil@example.com",
            role: UserRole.ALUNO,
            ativo: true,
        };

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

        test("retorna 404 se o usuário não existe mais", async () => {
            findUser.mockRejectedValue(new Error("Usuário não encontrado"));
            const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO });
            const response = await app.inject({
                method: "GET",
                url: "/auth/me",
                headers: { authorization: `Bearer ${token}` },
            });
            expect(response.statusCode).toBe(404);
        });
    });
});