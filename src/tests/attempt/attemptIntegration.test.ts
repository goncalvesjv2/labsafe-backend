import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";

describe("Testes de integração de tentativas", () => {
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
    const emails = [teacherEmail, otherTeacherEmail, studentEmail, otherStudentEmail, adminEmail];

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
        try {
            await prisma.attempt.deleteMany({ where: { quiz: { usuario: { email: { in: emails } } } } });
            await prisma.quiz.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.conteudo.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            await app.close();
            await prisma.$disconnect();
        }
    }, 30000);

    test("deve salvar a tentativa, as respostas e o log quando o aluno acerta tudo", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const response = await sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({
            attempt: { id: expect.any(Number), quizId: quiz.id, studentId, score: 100, approved: true, createdAt: expect.any(String) },
            totalQuestions: 3,
            correctCount: 3
        });

        const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: body.attempt.id } });
        expect(attempt.quiz_id).toBe(quiz.id);
        expect(attempt.student_id).toBe(studentId);
        expect(Number(attempt.score)).toBe(100);
        expect(attempt.approved).toBe(true);
        const answers = await prisma.answer.findMany({ where: { attempt_id: attempt.id } });
        expect(answers).toHaveLength(3);

        for (const answer of correctAnswers) {
            expect(answers).toContainEqual(expect.objectContaining({ question_id: answer.questionId, alternative_id: answer.alternativeId }));
        }

        expect(await prisma.logs.count({
            where: { user_id: studentId, action: "CADASTRO_TENTATIVA", description: { contains: `tentativa de ID ${attempt.id} ` } }
        })).toBe(1);
    });

    test("deve aprovar o aluno que acerta três de cinco questões", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await createQuiz(5);
        const answers = [correctAnswers[0], correctAnswers[1], correctAnswers[2], incorrectAnswers[3], incorrectAnswers[4]];
        const response = await sendAttempt(quiz.id, answers);

        expect(response.statusCode).toBe(201);
        expect(response.json().attempt.score).toBe(60);
        expect(response.json().attempt.approved).toBe(true);
        expect(response.json().correctCount).toBe(3);
    });

    test("deve reprovar e salvar nota com uma casa decimal abaixo de 60 por cento", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await createQuiz();
        const response = await sendAttempt(quiz.id, [correctAnswers[0], incorrectAnswers[1], incorrectAnswers[2]]);

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.attempt.score).toBe(33.3);
        expect(body.attempt.approved).toBe(false);
        expect(body.correctCount).toBe(1);
        const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: body.attempt.id } });
        expect(Number(attempt.score)).toBe(33.3);
        expect(attempt.approved).toBe(false);
    });

    test("deve arredondar a nota para 66.7 ao acertar duas de três questões", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await createQuiz();
        const response = await sendAttempt(quiz.id, [correctAnswers[0], correctAnswers[1], incorrectAnswers[2]]);
        expect(response.statusCode).toBe(201);
        expect(response.json().attempt.score).toBe(66.7);
        expect(response.json().attempt.approved).toBe(true);
    });

    test("deve criar outra tentativa após o aluno reprovar", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await createQuiz();
        const first = await sendAttempt(quiz.id, incorrectAnswers);
        const second = await sendAttempt(quiz.id, correctAnswers);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(first.json().attempt.score).toBe(0);
        expect(first.json().attempt.approved).toBe(false);
        expect(second.json().attempt.score).toBe(100);
        expect(second.json().attempt.approved).toBe(true);
        expect(first.json().attempt.id).not.toBe(second.json().attempt.id);
        expect(await prisma.attempt.count({ where: { quiz_id: quiz.id, student_id: studentId } })).toBe(2);
        expect(await prisma.answer.count({ where: { attempt: { quiz_id: quiz.id } } })).toBe(6);
    });

    test("deve aceitar um quiz com dez questões", async () => {
        const { quiz, correctAnswers } = await createQuiz(10);
        const response = await sendAttempt(quiz.id, correctAnswers);
        expect(response.statusCode).toBe(201);
        expect(response.json().totalQuestions).toBe(10);
        expect(response.json().correctCount).toBe(10);
        expect(response.json().attempt.score).toBe(100);
        expect(await prisma.answer.count({ where: { attempt_id: response.json().attempt.id } })).toBe(10);
    });

    test("deve usar o aluno autenticado e calcular a nota mesmo com campos extras no corpo", async () => {
        const { quiz, incorrectAnswers } = await createQuiz();
        const response = await app.inject({
            method: "POST",
            url: "/api/attempts",
            headers: { authorization: `Bearer ${studentToken}` },
            payload: { quizId: quiz.id, answers: incorrectAnswers, studentId: otherStudentId, score: 100, approved: true }
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().attempt.studentId).toBe(studentId);
        expect(response.json().attempt.score).toBe(0);
        expect(response.json().attempt.approved).toBe(false);
        expect(await prisma.attempt.count({ where: { quiz_id: quiz.id, student_id: otherStudentId } })).toBe(0);
    });

    test("deve permitir que o criador do quiz consulte uma tentativa com suas respostas", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const submitted = await sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const attemptId = submitted.json().attempt.id;
        const response = await app.inject({
            method: "GET",
            url: `/api/attempts/${attemptId}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.id).toBe(attemptId);
        expect(body.studentId).toBe(studentId);
        expect(body.answers).toHaveLength(3);

        for (const answer of correctAnswers) {
            expect(body.answers).toContainEqual({ id: expect.any(Number), attemptId, questionId: answer.questionId, alternativeId: answer.alternativeId });
        }
    });

    test("deve listar somente as tentativas do quiz selecionado", async () => {
        const firstQuiz = await createQuiz();
        const secondQuiz = await createQuiz();
        const first = await sendAttempt(firstQuiz.quiz.id, firstQuiz.correctAnswers);
        const second = await sendAttempt(secondQuiz.quiz.id, secondQuiz.correctAnswers);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${firstQuiz.quiz.id}/attempts`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([first.json().attempt]);
    });

    test("deve contar somente as tentativas do aluno no quiz selecionado", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await createQuiz();
        const anotherQuiz = await createQuiz();
        const first = await sendAttempt(quiz.id, incorrectAnswers);
        const second = await sendAttempt(quiz.id, correctAnswers);
        const anotherStudent = await sendAttempt(quiz.id, correctAnswers, otherStudentToken);
        const anotherQuizAttempt = await sendAttempt(anotherQuiz.quiz.id, anotherQuiz.correctAnswers);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(anotherStudent.statusCode).toBe(201);
        expect(anotherQuizAttempt.statusCode).toBe(201);
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/students/${studentId}/attempts`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            studentId,
            quizId: quiz.id,
            totalAttempts: 2,
            attempts: [first.json().attempt, second.json().attempt]
        });
    });

    test("deve retornar lista vazia e contagem zero quando não existem tentativas", async () => {
        const { quiz } = await createQuiz();
        const list = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/attempts`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const history = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/students/${studentId}/attempts`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(list.statusCode).toBe(200);
        expect(list.json()).toEqual([]);
        expect(history.statusCode).toBe(200);
        expect(history.json()).toEqual({ studentId, quizId: quiz.id, totalAttempts: 0, attempts: [] });
    });

    test("deve manter uma questão respondida no quiz original durante a edição", async () => {
        const { quiz, correctAnswers } = await createQuiz(1);
        const anotherQuiz = await createQuiz(0);
        const submitted = await sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const questionId = correctAnswers[0].questionId;

        const transfer = await app.inject({
            method: "PATCH",
            url: `/api/questions/${questionId}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: anotherQuiz.quiz.id }
        });
        expect(transfer.statusCode).toBe(400);

        const edit = await app.inject({
            method: "PATCH",
            url: `/api/questions/${questionId}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: anotherQuiz.quiz.id, statement: "Enunciado atualizado" }
        });
        expect(edit.statusCode).toBe(200);
        expect(edit.json()).toEqual({ id: questionId, quizId: quiz.id, statement: "Enunciado atualizado" });

        const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
        const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: submitted.json().attempt.id } });
        const answers = await prisma.answer.findMany({ where: { attempt_id: attempt.id } });
        expect(question.quiz_id).toBe(quiz.id);
        expect(attempt.quiz_id).toBe(quiz.id);
        expect(Number(attempt.score)).toBe(100);
        expect(answers).toHaveLength(1);
        expect(answers[0].question_id).toBe(questionId);
        expect(answers[0].alternative_id).toBe(correctAnswers[0].alternativeId);
        expect(await prisma.question.count({ where: { quiz_id: anotherQuiz.quiz.id } })).toBe(0);
    });

    test("deve excluir o quiz com suas questões, alternativas, tentativas e respostas", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await createQuiz();
        const anotherQuiz = await createQuiz(1);
        const first = await sendAttempt(quiz.id, incorrectAnswers);
        const second = await sendAttempt(quiz.id, correctAnswers);
        const anotherStudent = await sendAttempt(quiz.id, correctAnswers, otherStudentToken);
        const anotherQuizAttempt = await sendAttempt(anotherQuiz.quiz.id, anotherQuiz.correctAnswers);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(anotherStudent.statusCode).toBe(201);
        expect(anotherQuizAttempt.statusCode).toBe(201);

        const questionIds = correctAnswers.map((answer) => answer.questionId);
        const alternatives = await prisma.alternative.findMany({ where: { question_id: { in: questionIds } } });
        const alternativeIds = alternatives.map((alternative) => alternative.id);
        const attemptIds = [first.json().attempt.id, second.json().attempt.id, anotherStudent.json().attempt.id];
        expect(alternatives).toHaveLength(6);
        expect(await prisma.answer.count({ where: { attempt_id: { in: attemptIds } } })).toBe(9);

        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
        expect(await prisma.question.count({ where: { id: { in: questionIds } } })).toBe(0);
        expect(await prisma.alternative.count({ where: { id: { in: alternativeIds } } })).toBe(0);
        expect(await prisma.attempt.count({ where: { id: { in: attemptIds } } })).toBe(0);
        expect(await prisma.answer.count({ where: { attempt_id: { in: attemptIds } } })).toBe(0);

        expect(await prisma.conteudo.findUnique({ where: { id: quiz.conteudo_id } })).not.toBeNull();
        expect(await prisma.quiz.findUnique({ where: { id: anotherQuiz.quiz.id } })).not.toBeNull();
        expect(await prisma.question.count({ where: { quiz_id: anotherQuiz.quiz.id } })).toBe(1);
        expect(await prisma.alternative.count({ where: { question_id: anotherQuiz.correctAnswers[0].questionId } })).toBe(2);
        expect(await prisma.attempt.findUnique({ where: { id: anotherQuizAttempt.json().attempt.id } })).not.toBeNull();
        expect(await prisma.answer.count({ where: { attempt_id: anotherQuizAttempt.json().attempt.id } })).toBe(1);
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "EXCLUSAO_QUIZ", description: { contains: `quiz de ID ${quiz.id} ` } }
        })).toBe(1);
    });

    test("deve impedir que outro professor exclua um quiz e suas tentativas", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const submitted = await sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);

        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${otherTeacherToken}` }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json().message).toBe("Você só pode excluir seus próprios quizzes");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).not.toBeNull();
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(3);
        expect(await prisma.alternative.count({ where: { question: { quiz_id: quiz.id } } })).toBe(6);
        expect(await prisma.attempt.findUnique({ where: { id: submitted.json().attempt.id } })).not.toBeNull();
        expect(await prisma.answer.count({ where: { attempt_id: submitted.json().attempt.id } })).toBe(3);
    });

    test("deve impedir envios por professores e administradores", async () => {
        const { quiz, correctAnswers } = await createQuiz();

        for (const token of [teacherToken, adminToken]) {
            const response = await sendAttempt(quiz.id, correctAnswers, token);
            expect(response.statusCode).toBe(403);
            expect(response.json().message).toBe("Somente alunos podem executar esta ação");
        }

        await expectNoAttempts(quiz.id);
    });

    test("deve impedir que alunos e administradores consultem tentativas", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const submitted = await sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const urls = [
            `/api/attempts/${submitted.json().attempt.id}`,
            `/api/quizzes/${quiz.id}/attempts`,
            `/api/quizzes/${quiz.id}/students/${studentId}/attempts`
        ];

        for (const token of [studentToken, adminToken]) {
            for (const url of urls) {
                const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
                expect(response.statusCode).toBe(403);
                expect(response.json().message).toBe("Somente professores podem executar esta ação");
            }
        }
    });

    test("deve impedir que outro professor consulte as tentativas do quiz", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const submitted = await sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const urls = [
            `/api/attempts/${submitted.json().attempt.id}`,
            `/api/quizzes/${quiz.id}/attempts`,
            `/api/quizzes/${quiz.id}/students/${studentId}/attempts`
        ];

        for (const url of urls) {
            const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${otherTeacherToken}` } });
            expect(response.statusCode).toBe(404);
            expect(response.json().message).toBe("Você pode somente consultar tentativas dos seus próprios quizzes");
        }
    });

    test("deve rejeitar todas as rotas sem autenticação", async () => {
        const submitted = await app.inject({
            method: "POST",
            url: "/api/attempts",
            payload: { quizId: 1, answers: [{ questionId: 1, alternativeId: 1 }] }
        });
        expect(submitted.statusCode).toBe(401);

        for (const url of ["/api/attempts/1", "/api/quizzes/1/attempts", "/api/quizzes/1/students/1/attempts"]) {
            const response = await app.inject({ method: "GET", url });
            expect(response.statusCode).toBe(401);
        }
    });

    test("deve rejeitar tokens inválidos ou expirados", async () => {
        const expiredToken = app.jwt.sign({ sub: studentId }, { expiresIn: -1 });

        for (const token of ["token-invalido", expiredToken]) {
            const submitted = await app.inject({
                method: "POST",
                url: "/api/attempts",
                headers: { authorization: `Bearer ${token}` },
                payload: { quizId: 1, answers: [{ questionId: 1, alternativeId: 1 }] }
            });
            expect(submitted.statusCode).toBe(401);

            for (const url of ["/api/attempts/1", "/api/quizzes/1/attempts", "/api/quizzes/1/students/1/attempts"]) {
                const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
                expect(response.statusCode).toBe(401);
            }
        }
    });

    test("deve rejeitar dados inválidos sem salvar tentativas ou respostas", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const invalidBodies = [
            { quizId: String(quiz.id), answers: correctAnswers },
            { quizId: quiz.id, answers: [] },
            { quizId: quiz.id, answers: [{ questionId: correctAnswers[0].questionId, alternativeId: "1" }] },
            { quizId: quiz.id }
        ];

        for (const payload of invalidBodies) {
            const response = await app.inject({
                method: "POST",
                url: "/api/attempts",
                headers: { authorization: `Bearer ${studentToken}` },
                payload
            });
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Dados inválidos");
            expect(response.json().errors.length).toBeGreaterThan(0);
        }

        await expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio para um quiz inexistente", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        await prisma.quiz.delete({ where: { id: quiz.id } });
        const response = await sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Quiz não encontrado");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio para um quiz sem questões", async () => {
        const { quiz } = await createQuiz(0);
        const response = await sendAttempt(quiz.id, [{ questionId: 1, alternativeId: 1 }]);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("O quiz deve ter entre 1 e 10 questões para ser respondido");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio para um quiz com onze questões", async () => {
        const { quiz, correctAnswers } = await createQuiz(11);
        const response = await sendAttempt(quiz.id, correctAnswers.slice(0, 10));

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("O quiz deve ter entre 1 e 10 questões para ser respondido");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir o envio quando faltam respostas", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const response = await sendAttempt(quiz.id, [correctAnswers[0]]);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Responda todas as questões do quiz");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir respostas repetidas para a mesma questão", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const response = await sendAttempt(quiz.id, [correctAnswers[0], correctAnswers[0], correctAnswers[2]]);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Envie exatamente uma resposta para cada questão do quiz");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir respostas para questões de outro quiz", async () => {
        const firstQuiz = await createQuiz();
        const secondQuiz = await createQuiz();
        const answers = [secondQuiz.correctAnswers[0], firstQuiz.correctAnswers[1], firstQuiz.correctAnswers[2]];
        const response = await sendAttempt(firstQuiz.quiz.id, answers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Envie exatamente uma resposta para cada questão do quiz");
        await expectNoAttempts(firstQuiz.quiz.id);
        await expectNoAttempts(secondQuiz.quiz.id);
    });

    test("deve impedir uma alternativa que pertence a outra questão", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const answers = [
            { questionId: correctAnswers[0].questionId, alternativeId: correctAnswers[1].alternativeId },
            correctAnswers[1],
            correctAnswers[2]
        ];
        const response = await sendAttempt(quiz.id, answers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A alternativa selecionada não pertence à questão");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir uma questão com menos de duas alternativas", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await createQuiz(1);
        await prisma.alternative.delete({ where: { id: incorrectAnswers[0].alternativeId } });
        const response = await sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Cada questão deve ter entre 2 e 4 alternativas");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir uma questão com mais de quatro alternativas", async () => {
        const { quiz, correctAnswers } = await createQuiz(1);
        const questionId = correctAnswers[0].questionId;
        await prisma.alternative.createMany({
            data: [
                { question_id: questionId, text: "Terceira alternativa", correct: false },
                { question_id: questionId, text: "Quarta alternativa", correct: false },
                { question_id: questionId, text: "Quinta alternativa", correct: false }
            ]
        });
        const response = await sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Cada questão deve ter entre 2 e 4 alternativas");
        await expectNoAttempts(quiz.id);
    });

    test("deve impedir questões sem correta ou com mais de uma correta", async () => {
        const { quiz, correctAnswers } = await createQuiz(1);

        for (const correct of [false, true]) {
            await prisma.alternative.updateMany({ where: { question_id: correctAnswers[0].questionId }, data: { correct } });
            const response = await sendAttempt(quiz.id, correctAnswers);

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Cada questão deve ter exatamente 1 alternativa correta");
        }

        await expectNoAttempts(quiz.id);
    });

    test("deve rejeitar IDs inválidos nas consultas", async () => {
        const urls = [
            "/api/attempts/abc",
            "/api/attempts/0",
            "/api/quizzes/-1/attempts",
            `/api/quizzes/1/students/1.5/attempts`,
            `/api/quizzes/abc/students/${studentId}/attempts`
        ];

        for (const url of urls) {
            const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${teacherToken}` } });
            expect(response.statusCode).toBe(400);
        }
    });

    test("deve informar quando a tentativa consultada não existe", async () => {
        const { quiz, correctAnswers } = await createQuiz();
        const submitted = await sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const attemptId = submitted.json().attempt.id;
        await prisma.attempt.delete({ where: { id: attemptId } });
        const response = await app.inject({
            method: "GET",
            url: `/api/attempts/${attemptId}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().message).toBe("Tentativa não encontrada");
    });

    test("deve informar quando o quiz consultado não existe", async () => {
        const { quiz } = await createQuiz(0);
        await prisma.quiz.delete({ where: { id: quiz.id } });
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/attempts`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().message).toBe("Quiz não encontrado");
    });
});
