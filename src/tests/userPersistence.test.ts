import { afterAll, describe, expect, test } from "@jest/globals";
import { connect, pool } from "../database/db";

describe("Teste de persistência - usuário", () => {
    const email = `teste.${Date.now()}@example.com`;

    afterAll(async () => {
        await pool.end();
    });

    test("deve salvar e consultar um usuário", async () => {
        const client = await connect();
        let userId: number | undefined;

        try {
            const result = await client.query(
                `INSERT INTO usuario (name, email, senha, role)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                ["Usuário Teste", email, "senha_teste_hash", "Aluno(a)"]
            );

            userId = result.rows[0].id;

            const user = await client.query(
                "SELECT * FROM usuario WHERE id = $1",
                [userId]
            );

            expect(user.rows).toHaveLength(1);
            expect(user.rows[0].email).toBe(email);
            expect(user.rows[0].name).toBe("Usuário Teste");
        } finally {
            if (userId !== undefined) {
                await client.query(
                    "DELETE FROM usuario WHERE id = $1",
                    [userId]
                );
            }
            client.release();
        }
    });
});