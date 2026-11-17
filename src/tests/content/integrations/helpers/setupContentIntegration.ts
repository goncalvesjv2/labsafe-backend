import "dotenv/config";
import { afterAll, beforeAll, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../../../app";
import { prisma } from "../../../../database/prisma";
import { user_role } from "../../../../generated/prisma/enums";

export function setupContentIntegration() {
    let token: string;
    let teacherId: number;
    const teacherEmail = `professor.${randomUUID()}@example.com`;
    const studentEmail = `aluno.conteudo.${randomUUID()}@example.com`;
    const adminEmail = `admin.conteudo.${randomUUID()}@example.com`;
    const newTeacherEmail = `professor.fluxo.${randomUUID()}@example.com`;
    const studentListEmail = `aluno.listagem.${randomUUID()}@example.com`;
    const studentDetailEmail = `aluno.consulta.${randomUUID()}@example.com`;
    const adminListEmail = `admin.listagem.${randomUUID()}@example.com`;
    const adminDetailEmail = `admin.consulta.${randomUUID()}@example.com`;
    const password = "SenhaTeste123!";

    beforeAll(async () => {
        await app.ready();
        const teacher = await prisma.usuario.create({
            data: {
                name: "Professor Teste",
                email: teacherEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Professor_a_
            }
        });
        teacherId = teacher.id;

        const login = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: teacherEmail, password }
        });
        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        token = loginBody.token;
    }, 30000);

    afterAll(async () => {
        await Promise.all([app.close(), prisma.$disconnect()]);
    }, 30000);

    return {
        get token() { return token; },
        get teacherId() { return teacherId; },
        get teacherEmail() { return teacherEmail; },
        get studentEmail() { return studentEmail; },
        get adminEmail() { return adminEmail; },
        get newTeacherEmail() { return newTeacherEmail; },
        get studentListEmail() { return studentListEmail; },
        get studentDetailEmail() { return studentDetailEmail; },
        get adminListEmail() { return adminListEmail; },
        get adminDetailEmail() { return adminDetailEmail; },
        get password() { return password; }
    };
}
