import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { app } from "../app";
import { pool } from "../database/db";
import { generateToken } from "../utils/token";
import { IUser } from "../interfaces/IUser";
import { UserRole } from "../utils/user";

describe("Teste E2E - usuários", () => {
    let userId: number | undefined;
    const email = `teste.e2e.${Date.now()}@example.com`;

    beforeAll(async () => {
        await app.ready();
    });

    afterAll(async () => {
        try {
            if (userId !== undefined) {
                await pool.query(
                    "DELETE FROM usuario WHERE id = $1",
                    [userId]
                );
            }
        } finally {
            await app.close();
            await pool.end();
        }
    });

    test("deve criar e consultar um usuário pela API", async () => {
        const admin = {
            id: 1,
            name: "Administrador de Teste",
            email: "admin.teste@example.com",
            senha: "hashTestPassword",
            password: "hashTestPassword",
            role: UserRole.ADMIN,
            ativo: true
        } as IUser;

        const { token } = generateToken(admin);

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                authorization: `Bearer ${token}`
            },
            payload: {
                name: "Usuário E2E",
                email,
                password: "SenhaTeste123!",
                role: UserRole.ALUNO
            }
        });

        expect(createResponse.statusCode).toBe(201);

        const createdUser = createResponse.json();
        userId = createdUser.id;

        expect(createdUser).toMatchObject({
            name: "Usuário E2E",
            email
        });
        expect(userId).toBeDefined();

        const getResponse = await app.inject({
            method: "GET",
            url: `/api/users/${userId}`,
            headers: {
                authorization: `Bearer ${token}`
            }
        });

        expect(getResponse.statusCode).toBe(200);
        expect(getResponse.json()).toMatchObject({
            id: userId,
            name: "Usuário E2E",
            email,
            role: UserRole.ALUNO
        });
    });
});