import "dotenv/config";
import { afterAll, beforeAll, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../../../app";
import { prisma } from "../../../../database/prisma";
import { user_role } from "../../../../generated/prisma/enums";

export function setupQuizIntegration() {
    let teacherId: number;
    let otherTeacherId: number;
    let studentId: number;
    let adminId: number;
    let teacherToken: string;
    let studentToken: string;
    let adminToken: string;
    let passwordHash: string;
    const password = "SenhaTeste123!";
    const teacherEmail = `professor.quiz.${randomUUID()}@example.com`;
    const otherTeacherEmail = `outro.professor.quiz.${randomUUID()}@example.com`;
    const studentEmail = `aluno.quiz.${randomUUID()}@example.com`;
    const adminEmail = `admin.quiz.${randomUUID()}@example.com`;
    const changedRoleEmail = `perfil.quiz.${randomUUID()}@example.com`;
    const deletedUserEmail = `excluido.quiz.${randomUUID()}@example.com`;
    const emails = [teacherEmail, otherTeacherEmail, studentEmail, adminEmail, changedRoleEmail, deletedUserEmail];

    async function login(email: string) {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.token).toEqual(expect.any(String));
        return body.token as string;
    }

    async function createContent(professorId = teacherId) {
        return prisma.conteudo.create({
            data: {
                professor_id: professorId,
                title: `Conteúdo do quiz ${randomUUID()}`,
                description: "Orientações de segurança no laboratório."
            }
        });
    }

    async function createQuizFixture(professorId = teacherId) {
        const content = await createContent(professorId);
        const quiz = await prisma.quiz.create({ data: { conteudo_id: content.id, professor_id: professorId } });
        return { content, quiz };
    }

    async function countQuizzes() {
        return prisma.quiz.count({
            where: { conteudo: { usuario: { email: { in: emails } } } }
        });
    }

    beforeAll(async () => {
        app.log.level = "silent";
        await app.ready();
        passwordHash = await bcrypt.hash(password, 10);
        const teacher = await prisma.usuario.create({
            data: { name: "Professor do Quiz", email: teacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        teacherId = teacher.id;
        const otherTeacher = await prisma.usuario.create({
            data: { name: "Outro Professor", email: otherTeacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        otherTeacherId = otherTeacher.id;
        const student = await prisma.usuario.create({
            data: { name: "Aluno do Quiz", email: studentEmail, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        studentId = student.id;
        const admin = await prisma.usuario.create({
            data: { name: "Administrador do Quiz", email: adminEmail, senha: passwordHash, role: user_role.Admin }
        });
        adminId = admin.id;
        teacherToken = await login(teacherEmail);
        studentToken = await login(studentEmail);
        adminToken = await login(adminEmail);
    }, 30000);

    afterAll(async () => {
        await Promise.all([app.close(), prisma.$disconnect()]);
    }, 30000);

    return {
        get teacherId() { return teacherId; },
        get otherTeacherId() { return otherTeacherId; },
        get studentId() { return studentId; },
        get adminId() { return adminId; },
        get teacherToken() { return teacherToken; },
        get studentToken() { return studentToken; },
        get adminToken() { return adminToken; },
        get passwordHash() { return passwordHash; },
        get password() { return password; },
        get teacherEmail() { return teacherEmail; },
        get otherTeacherEmail() { return otherTeacherEmail; },
        get studentEmail() { return studentEmail; },
        get adminEmail() { return adminEmail; },
        get changedRoleEmail() { return changedRoleEmail; },
        get deletedUserEmail() { return deletedUserEmail; },
        get emails() { return emails; },
        get login() { return login; },
        get createContent() { return createContent; },
        get createQuizFixture() { return createQuizFixture; },
        get countQuizzes() { return countQuizzes; }
    };
}
