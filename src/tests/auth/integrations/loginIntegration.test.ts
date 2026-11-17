import { describe, expect, test } from "@jest/globals";
import { setupAuthIntegration } from "./helpers/setupAuthIntegration";

describe("Testes de integração - autenticação", () => {
    const context = setupAuthIntegration();

    describe("Login", () => {
        test("deve retornar 200 ao realizar login com sucesso", async () => {
            context.loginServiceMock.mockResolvedValue({
                token: "token-de-teste",
            });

            const response = await context.app.inject({
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

            expect(context.loginServiceMock).toHaveBeenCalledWith(
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
                const response = await context.app.inject({ method: "POST", url: "/auth/login", payload });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Dados inválidos");
                expect(response.json().errors).toEqual(expect.any(Array));
                expect(context.loginServiceMock).not.toHaveBeenCalled();
            }
        });

        test("Status 401 não autorizado", async () => {
            context.loginServiceMock.mockRejectedValue(
                new Error("E-mail ou senha inválidos")
            );

            const response = await context.app.inject({
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
});
