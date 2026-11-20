/// <reference types="jest" />
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { UserRole } from "../../../utils/user";

jest.mock("../../../database/prisma", () => ({
    prisma: {
        logs: { findMany: jest.fn(), create: jest.fn() },
        usuario: { findUnique: jest.fn() }
    }
}));

describe("GET /api/logs", () => {
    const admin = {
        id: 1,
        name: "Admin Teste",
        email: "admin@example.test",
        senha: null,
        role: user_role.Admin,
        ativo: true
    };
    let token: string;

    beforeAll(async () => {
        await app.ready();
        token = app.jwt.sign({ sub: admin.id, role: UserRole.ADMIN });
    });

    beforeEach(() => {
        jest.mocked(prisma.usuario.findUnique).mockReset().mockResolvedValue(admin as any);
        jest.mocked(prisma.logs.findMany).mockReset().mockResolvedValue([]);
        jest.mocked(prisma.logs.create).mockReset().mockResolvedValue({ id: 2 } as any);
    });

    afterAll(async () => {
        await app.close();
    });

    test("admin pode listar logs com os campos usados pela API", async () => {
        const createdAt = new Date("2026-11-19T12:00:00.000Z");
        const log = {
            id: 1, user_id: 2, action: "CADASTRO_USUARIO",
            description: "Usuário cadastrado", created_at: createdAt,
            usuario: { email: "auditoria@example.test" }
        };
        jest.mocked(prisma.logs.findMany).mockResolvedValue([log]);

        const response = await app.inject({
            method: "GET", url: "/api/logs",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([{
            id: 1, userId: 2, email: "auditoria@example.test", action: "CADASTRO_USUARIO",
            description: "Usuário cadastrado", createdAt: createdAt.toISOString()
        }]);
    });

    test("retorna lista vazia quando não existem logs", async () => {
        const response = await app.inject({
            method: "GET", url: "/api/logs",
            headers: { authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    test.each([undefined, "Bearer invalido"])("recusa acesso sem autenticação válida: %s", async (authorization) => {
        const response = await app.inject({
            method: "GET", url: "/api/logs",
            headers: authorization ? { authorization } : {}
        });
        expect(response.statusCode).toBe(401);
        expect(prisma.logs.findMany).not.toHaveBeenCalled();
    });

    test.each([user_role.Aluno_a_, user_role.Professor_a_])("recusa perfil %s mesmo com cargo Admin no token", async (role) => {
        jest.mocked(prisma.usuario.findUnique).mockResolvedValue({ ...admin, role } as any);
        const response = await app.inject({
            method: "GET", url: "/api/logs",
            headers: { authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(403);
        expect(prisma.logs.findMany).not.toHaveBeenCalled();
        expect(prisma.logs.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ user_id: admin.id, action: "FALHA_AUTORIZACAO" })
        });
    });

    test("recusa administrador inativo", async () => {
        jest.mocked(prisma.usuario.findUnique).mockResolvedValue({ ...admin, ativo: false } as any);
        const response = await app.inject({
            method: "GET", url: "/api/logs",
            headers: { authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(401);
        expect(prisma.logs.findMany).not.toHaveBeenCalled();
    });

    test.each(["POST", "PUT", "PATCH", "DELETE", "HEAD"] as const)("não disponibiliza o método %s", async (method) => {
        const response = await app.inject({
            method, url: "/api/logs",
            headers: { authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(404);
        expect(prisma.logs.findMany).not.toHaveBeenCalled();
    });

    test("retorna 500 quando a consulta falha", async () => {
        jest.mocked(prisma.logs.findMany).mockRejectedValue(new Error("Falha na consulta"));
        const response = await app.inject({
            method: "GET", url: "/api/logs",
            headers: { authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(500);
    });
});
