import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";

describe("Testes de integração do PubChem", () => {
    let baseUrl: string;
    let studentToken: string;
    let studentId: number;
    const testId = Date.now();
    const studentEmail = `aluno.pubchem.${testId}@example.com`;
    const teacherEmail = `professor.pubchem.${testId}@example.com`;
    const adminEmail = `admin.pubchem.${testId}@example.com`;
    const changedRoleEmail = `aluno.perfil.${testId}@example.com`;
    const deletedEmail = `aluno.excluido.${testId}@example.com`;
    const password = "SenhaTeste123!";

    beforeAll(async () => {
        baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });
        const student = await prisma.usuario.create({
            data: {
                name: "Aluno Teste PubChem",
                email: studentEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Aluno_a_
            }
        });
        studentId = student.id;
        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: studentEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        studentToken = loginBody.token;
    }, 30000);

    afterAll(async () => {
        try {
            const emails = [studentEmail, teacherEmail, adminEmail, changedRoleEmail, deletedEmail];
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            await app.close();
            await prisma.$disconnect();
        }
    }, 30000);

    test("deve permitir que um aluno autenticado consulte um composto no PubChem", async () => {
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET",
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("application/json");
        const body = await response.json();
        expect(body.cid).toBe(962);
        expect(body.title).toEqual(expect.any(String));
        expect(body.molecularFormula).toBe("H2O");
        expect(Number(body.molecularWeight)).toBeGreaterThan(0);
    }, 30000);

    test("deve impedir que um administrador consulte o PubChem", async () => {
        const admin = await prisma.usuario.create({
            data: {
                name: "Administrador Teste PubChem",
                email: adminEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Admin
            }
        });
        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        const adminToken = loginBody.token;
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET",
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.message).toBe("Somente alunos podem executar esta ação");
        const logs = await prisma.logs.findMany({
            where: { user_id: admin.id, action: "FALHA_AUTORIZACAO" }
        });
        expect(logs).toHaveLength(1);
        expect(logs[0].description).toBe("Usuário tentou acessar uma ação exclusiva de aluno");
    }, 30000);

    test("deve impedir que um professor consulte o PubChem", async () => {
        const teacher = await prisma.usuario.create({
            data: {
                name: "Professor Teste PubChem",
                email: teacherEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Professor_a_
            }
        });

        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: teacherEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        const teacherToken = loginBody.token;
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET",
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.message).toBe("Somente alunos podem executar esta ação");
        const logs = await prisma.logs.findMany({
            where: { user_id: teacher.id, action: "FALHA_AUTORIZACAO" }
        });
        expect(logs).toHaveLength(1);
        expect(logs[0].description).toBe("Usuário tentou acessar uma ação exclusiva de aluno");
    }, 30000);

    test("deve rejeitar uma consulta sem token", async () => {
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET"
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.code).toBe("FST_JWT_NO_AUTHORIZATION_IN_HEADER");
    }, 30000);

    test("deve rejeitar uma consulta com token inválido", async () => {
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET",
            headers: { Authorization: "Bearer token-invalido" }
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.code).toBe("FST_JWT_AUTHORIZATION_TOKEN_INVALID");
    }, 30000);

    test("deve rejeitar uma consulta com token expirado", async () => {
        const expiredToken = app.jwt.sign({
            sub: studentId,
            role: UserRole.ALUNO
        }, { expiresIn: -1 });
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET",
            headers: { Authorization: `Bearer ${expiredToken}` }
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.code).toBe("FST_JWT_AUTHORIZATION_TOKEN_EXPIRED");
    }, 30000);

    test("deve retornar 404 quando o aluno consultar um composto inexistente", async () => {
        const compoundName = `composto-inexistente-${testId}`;
        const response = await fetch(`${baseUrl}/api/compounds/${compoundName}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.message).toBe("Composto não encontrado no PubChem");
    }, 30000);

    test("deve bloquear o token antigo de aluno após mudança para professor", async () => {
        const student = await prisma.usuario.create({
            data: {
                name: "Aluno que será professor",
                email: changedRoleEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Aluno_a_
            }
        });
        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: changedRoleEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        const oldToken = loginBody.token;
        await prisma.usuario.update({
            where: { id: student.id },
            data: { role: user_role.Professor_a_ }
        });
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET",
            headers: { Authorization: `Bearer ${oldToken}` }
        });
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.message).toBe("Somente alunos podem executar esta ação");
    }, 30000);

    test("deve rejeitar o token antigo de um usuário que foi excluído", async () => {
        const student = await prisma.usuario.create({
            data: {
                name: "Aluno que será excluído",
                email: deletedEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Aluno_a_
            }
        });
        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: deletedEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        const deletedUserToken = loginBody.token;
        await prisma.logs.deleteMany({ where: { user_id: student.id } });
        await prisma.usuario.delete({ where: { id: student.id } });
        const response = await fetch(`${baseUrl}/api/compounds/Water`, {
            method: "GET",
            headers: { Authorization: `Bearer ${deletedUserToken}` }
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.message).toBe("Usuário não encontrado");
    }, 30000);
});
