import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import type { IUserResponse } from "../../interfaces/IUser";
import { UserRole } from "../../utils/user";


const findUser = jest.fn<(id: number) => Promise<IUserResponse>>();
const authenticate = jest.fn<(email: string, password: string) => Promise<{ token: string }>>();

describe("Consulta do proprio perfil", () => {
    const app = Fastify();
    const profile = {
        id: 7,
        name: "Usuario de teste",
        email: "perfil@example.com",
        role: UserRole.ALUNO,
        ativo: true,
    };

    beforeAll(async () => {
        jest.doMock("../../services/authService", () => ({ loginService: authenticate }));
        jest.doMock("../../services/userService", () => ({ listUserByIdService: findUser }));
        const { authRoutes } = await import("../../routes/authRoutes");
        await app.register(fastifyJwt, { secret: "profile-test-secret" });
        await app.register(authRoutes, { prefix: "/auth" });
        await app.ready();
    });

    beforeEach(() => {
        findUser.mockReset();
        authenticate.mockReset();
    });

    afterAll(async () => {
        await app.close();
    });

    test.each([UserRole.ADMIN, UserRole.PROFESSOR, UserRole.ALUNO])("retorna apenas os dados do usuario autenticado para %s", async (role) => {
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

    test("rejeita uma requisicao sem token", async () => {
        const response = await app.inject({ method: "GET", url: "/auth/me" });
        expect(response.statusCode).toBe(401);
        expect(findUser).not.toHaveBeenCalled();
    });

    test("rejeita um token invalido", async () => {
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

    test("retorna 404 se o usuario nao existe mais", async () => {
        findUser.mockRejectedValue(new Error("Usuario nao encontrado"));
        const token = app.jwt.sign({ sub: profile.id, role: UserRole.ALUNO });
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: { authorization: `Bearer ${token}` },
        });
        expect(response.statusCode).toBe(404);
    });

    test("mantem a rota de login funcionando", async () => {
        authenticate.mockResolvedValue({ token: "token-de-teste" });
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: profile.email, password: "SenhaTeste123!" },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ token: "token-de-teste" });
    });
});
