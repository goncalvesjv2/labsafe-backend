import {
    describe,
    expect,
    test,
    jest,
    beforeAll,
    afterAll,
} from "@jest/globals";

const loginServiceMock = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("../services/authService", () => ({
    loginService: loginServiceMock,
}));

import { app } from "../app";

describe("Testes de integração - autenticação", () => {
    beforeAll(async () => {
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
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
});