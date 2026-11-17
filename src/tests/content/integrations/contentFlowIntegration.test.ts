import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import bcrypt from "bcrypt";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { UserRole } from "../../../utils/user";
import { setupContentIntegration } from "./helpers/setupContentIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

describe("Teste de integração de conteúdos", () => {
    const context = setupContentIntegration();

    test("deve cadastrar professor, fazer login, criar conteúdo e consultar o resultado", async () => {
        await prisma.usuario.create({
            data: {
                name: "Administrador do Fluxo",
                email: context.adminEmail,
                senha: await bcrypt.hash(context.password, 10),
                role: user_role.Admin
            }
        });

        const adminLogin = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: context.adminEmail, password: context.password }
        });
        expect(adminLogin.statusCode).toBe(200);
        const adminLoginBody = adminLogin.json();
        expect(adminLoginBody.token).toEqual(expect.any(String));
        const adminToken = adminLoginBody.token;
        const teacher = { name: "Professor", email: context.newTeacherEmail, role: UserRole.PROFESSOR };
        const teacherResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            payload: teacher
        });
        expect(teacherResponse.statusCode).toBe(201);
        const createdTeacher = teacherResponse.json();
        expect(createdTeacher).toMatchObject({
            id: expect.any(Number),
            name: teacher.name,
            email: context.newTeacherEmail,
            role: UserRole.PROFESSOR
        });
        // Prepara a senha da conta usada neste cenário de acesso aos conteúdos.
        await prisma.usuario.update({
            where: { id: createdTeacher.id },
            data: { senha: await bcrypt.hash(context.password, 10) }
        });
        const teacherLogin = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: context.newTeacherEmail, password: context.password }
        });
        expect(teacherLogin.statusCode).toBe(200);
        const teacherLoginBody = teacherLogin.json();
        expect(teacherLoginBody.token).toEqual(expect.any(String));
        const teacherToken = teacherLoginBody.token;
        const content = {
            title: "Boas práticas no laboratório",
            description: "Siga as orientações do professor durante as atividades."
        };
        const contentResponse = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${teacherToken}`
            },
            payload: content
        });
        expect(contentResponse.statusCode).toBe(201);
        const createdContent = contentResponse.json();
        expect(createdContent).toMatchObject({
            id: expect.any(Number),
            teacherId: createdTeacher.id,
            title: content.title,
            description: content.description
        });
        const response = await app.inject({
            method: "GET",
            url: `/api/contents/${createdContent.id}`,
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id: createdContent.id,
            teacherId: createdTeacher.id,
            title: content.title,
            description: content.description
        });
    }, 30000);
});
