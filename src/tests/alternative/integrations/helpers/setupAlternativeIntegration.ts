import "dotenv/config";
import { afterAll, beforeAll, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../../../app";
import { prisma } from "../../../../database/prisma";
import { user_role } from "../../../../generated/prisma/enums";

export function setupAlternativeIntegration() {
    let teacherId: number;
    let otherTeacherId: number;
    let studentId: number;
    let adminId: number;
    let teacherToken: string;
    let otherTeacherToken: string;
    let studentToken: string;
    let adminToken: string;
    const password = "SenhaTeste123!";
    const teacherEmail = `prof.alternative.${randomUUID()}@example.com`;
    const otherTeacherEmail = `outro.prof.alternative.${randomUUID()}@example.com`;
    const studentEmail = `aluno.alternative.${randomUUID()}@example.com`;
    const adminEmail = `admin.alternative.${randomUUID()}@example.com`;

    async function login(email: string) {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().token).toEqual(expect.any(String));
        return response.json().token;
    }

    async function createQuestion() {
        const content = await prisma.conteudo.create({
            data: {
                professor_id: teacherId,
                title: "Conteúdo das alternativas",
                description: "Segurança no laboratório."
            }
        });
        const quiz = await prisma.quiz.create({
            data: { conteudo_id: content.id, professor_id: teacherId }
        });

        return prisma.question.create({
            data: { quiz_id: quiz.id, statement: "Qual equipamento protege os olhos?" }
        });
    }

    async function createAlternatives(questionId: number) {
        const correctAlternative = await prisma.alternative.create({
            data: { question_id: questionId, text: "Óculos de proteção", correct: true }
        });
        const incorrectAlternative = await prisma.alternative.create({
            data: { question_id: questionId, text: "Luvas", correct: false }
        });

        return { correctAlternative, incorrectAlternative };
    }

    beforeAll(async () => {
        app.log.level = "silent";
        await app.ready();
        const passwordHash = await bcrypt.hash(password, 10);
        const teacher = await prisma.usuario.create({
            data: { name: "Professor das Alternativas", email: teacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        teacherId = teacher.id;
        const otherTeacher = await prisma.usuario.create({
            data: { name: "Outro Professor", email: otherTeacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        otherTeacherId = otherTeacher.id;
        const student = await prisma.usuario.create({
            data: { name: "Aluno das Alternativas", email: studentEmail, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        studentId = student.id;
        const admin = await prisma.usuario.create({
            data: { name: "Admin das Alternativas", email: adminEmail, senha: passwordHash, role: user_role.Admin }
        });
        adminId = admin.id;
        teacherToken = await login(teacherEmail);
        otherTeacherToken = await login(otherTeacherEmail);
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
        get otherTeacherToken() { return otherTeacherToken; },
        get studentToken() { return studentToken; },
        get adminToken() { return adminToken; },
        get password() { return password; },
        get teacherEmail() { return teacherEmail; },
        get otherTeacherEmail() { return otherTeacherEmail; },
        get studentEmail() { return studentEmail; },
        get adminEmail() { return adminEmail; },
        get login() { return login; },
        get createQuestion() { return createQuestion; },
        get createAlternatives() { return createAlternatives; }
    };
}
