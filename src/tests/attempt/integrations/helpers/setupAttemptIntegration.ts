import "dotenv/config";
import { afterAll, beforeAll, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../../../app";
import { prisma } from "../../../../database/prisma";
import { user_role } from "../../../../generated/prisma/enums";

export function setupAttemptIntegration() {
    let teacherId: number;
    let studentId: number;
    let otherStudentId: number;
    let teacherToken: string;
    let otherTeacherToken: string;
    let studentToken: string;
    let otherStudentToken: string;
    let adminToken: string;
    const password = "SenhaTeste123!";
    const testId = randomUUID();
    const teacherEmail = `prof.tentativa.${testId}@example.com`;
    const otherTeacherEmail = `outro.prof.tentativa.${testId}@example.com`;
    const studentEmail = `aluno.tentativa.${testId}@example.com`;
    const otherStudentEmail = `outro.aluno.tentativa.${testId}@example.com`;
    const adminEmail = `admin.tentativa.${testId}@example.com`;

    async function login(email: string) {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().token).toEqual(expect.any(String));
        return response.json().token as string;
    }

    async function createQuiz(totalQuestions = 3) {
        const content = await prisma.conteudo.create({
            data: { professor_id: teacherId, title: "Conteúdo das tentativas", description: "Segurança no laboratório" }
        });
        const quiz = await prisma.quiz.create({
            data: { conteudo_id: content.id, professor_id: teacherId }
        });
        const correctAnswers = [];
        const incorrectAnswers = [];

        for (let number = 1; number <= totalQuestions; number++) {
            const question = await prisma.question.create({
                data: { quiz_id: quiz.id, statement: `Questão ${number}` }
            });
            const correct = await prisma.alternative.create({
                data: { question_id: question.id, text: "Alternativa correta", correct: true }
            });
            const incorrect = await prisma.alternative.create({
                data: { question_id: question.id, text: "Alternativa incorreta", correct: false }
            });

            correctAnswers.push({ questionId: question.id, alternativeId: correct.id });
            incorrectAnswers.push({ questionId: question.id, alternativeId: incorrect.id });
        }

        return { quiz, correctAnswers, incorrectAnswers };
    }

    async function sendAttempt(quizId: number, answers: { questionId: number, alternativeId: number }[], token = studentToken) {
        return app.inject({
            method: "POST",
            url: "/api/attempts",
            headers: { authorization: `Bearer ${token}` },
            payload: { quizId, answers }
        });
    }

    async function getResult(quizId: number | string, token = studentToken) {
        return app.inject({
            method: "GET",
            url: `/api/quizzes/${quizId}/result`,
            headers: { authorization: `Bearer ${token}` }
        });
    }

    async function expectNoAttempts(quizId: number) {
        expect(await prisma.attempt.count({ where: { quiz_id: quizId } })).toBe(0);
        expect(await prisma.answer.count({ where: { question: { quiz_id: quizId } } })).toBe(0);
    }

    beforeAll(async () => {
        app.log.level = "silent";
        await app.ready();
        const passwordHash = await bcrypt.hash(password, 10);
        const teacher = await prisma.usuario.create({
            data: { name: "Professora das Tentativas", email: teacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        teacherId = teacher.id;
        await prisma.usuario.create({
            data: { name: "Outro Professor", email: otherTeacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        const student = await prisma.usuario.create({
            data: { name: "Aluno das Tentativas", email: studentEmail, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        studentId = student.id;
        const otherStudent = await prisma.usuario.create({
            data: { name: "Outro Aluno", email: otherStudentEmail, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        otherStudentId = otherStudent.id;
        await prisma.usuario.create({
            data: { name: "Administrador", email: adminEmail, senha: passwordHash, role: user_role.Admin }
        });

        teacherToken = await login(teacherEmail);
        otherTeacherToken = await login(otherTeacherEmail);
        studentToken = await login(studentEmail);
        otherStudentToken = await login(otherStudentEmail);
        adminToken = await login(adminEmail);
    }, 30000);

    afterAll(async () => {
        await Promise.all([app.close(), prisma.$disconnect()]);
    }, 30000);

    return {
        get teacherId() { return teacherId; },
        get studentId() { return studentId; },
        get otherStudentId() { return otherStudentId; },
        get teacherToken() { return teacherToken; },
        get otherTeacherToken() { return otherTeacherToken; },
        get studentToken() { return studentToken; },
        get otherStudentToken() { return otherStudentToken; },
        get adminToken() { return adminToken; },
        get password() { return password; },
        get testId() { return testId; },
        get teacherEmail() { return teacherEmail; },
        get otherTeacherEmail() { return otherTeacherEmail; },
        get studentEmail() { return studentEmail; },
        get otherStudentEmail() { return otherStudentEmail; },
        get adminEmail() { return adminEmail; },
        get login() { return login; },
        get createQuiz() { return createQuiz; },
        get sendAttempt() { return sendAttempt; },
        get getResult() { return getResult; },
        get expectNoAttempts() { return expectNoAttempts; }
    };
}
