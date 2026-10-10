import { describe, expect, test, jest, beforeAll, afterAll } from "@jest/globals";

describe("Testes de integração - autenticação", () => {
    const loginServiceMock = jest.fn<(...args: any[]) => Promise<any>>();

    let app: typeof import("../app").app;

    beforeAll(async () => {
        jest.resetModules();

        jest.doMock("../services/authService", () => ({
            loginService: loginServiceMock,
        }));

        const appModule = await import("../app");
        app = appModule.app;

        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        jest.dontMock("../services/authService");
    });

    test("deve retornar 200 ao realizar login com sucesso", async () => {
        loginServiceMock.mockResolvedValue({
            accessToken: "accessToken",
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
            accessToken: "accessToken",
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