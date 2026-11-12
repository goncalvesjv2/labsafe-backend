import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";

describe("Testes de integração de alternativas", () => {
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
    const emails = [teacherEmail, otherTeacherEmail, studentEmail, adminEmail];

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
        try {
            // Excluir os quizzes também remove suas questões e alternativas.
            await prisma.quiz.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.conteudo.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            try {
                await app.close();
            } finally {
                await prisma.$disconnect();
            }
        }
    }, 30000);

    test("deve cadastrar duas alternativas, remover espaços e registrar os logs", async () => {
        const question = await createQuestion();
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: [
                { questionId: question.id, text: "  Óculos de proteção  ", correct: true, id: 999, teacherId: otherTeacherId },
                { questionId: question.id, text: "Luvas", correct: false }
            ]
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toHaveLength(2);
        expect(response.json()).toEqual(expect.arrayContaining([
            { id: expect.any(Number), questionId: question.id, text: "Óculos de proteção", correct: true },
            { id: expect.any(Number), questionId: question.id, text: "Luvas", correct: false }
        ]));
        const saved = await prisma.alternative.findMany({ where: { question_id: question.id } });
        expect(saved).toHaveLength(2);
        expect(saved).toEqual(expect.arrayContaining([
            { id: expect.any(Number), question_id: question.id, text: "Óculos de proteção", correct: true },
            { id: expect.any(Number), question_id: question.id, text: "Luvas", correct: false }
        ]));
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "CADASTRO_ALTERNATIVA", description: { endsWith: `na questão de ID ${question.id}` } }
        })).toBe(2);
    });

    test("deve permitir adicionar a terceira e a quarta alternativa uma por vez", async () => {
        const question = await createQuestion();
        await createAlternatives(question.id);

        for (const text of ["Jaleco", "Máscara"]) {
            const response = await app.inject({
                method: "POST",
                url: "/api/alternatives",
                headers: { authorization: `Bearer ${teacherToken}` },
                payload: [{ questionId: question.id, text, correct: false }]
            });

            expect(response.statusCode).toBe(201);
            expect(response.json()).toEqual([{ id: expect.any(Number), questionId: question.id, text, correct: false }]);
        }

        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(4);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
    });

    test("deve impedir o cadastro de apenas uma alternativa em uma questão vazia", async () => {
        const question = await createQuestion();
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: [{ questionId: question.id, text: "Óculos de proteção", correct: true }]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A questão deve ter no mínimo 2 alternativas");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "CADASTRO_ALTERNATIVA", description: { endsWith: `na questão de ID ${question.id}` } }
        })).toBe(0);
    });

    test("deve impedir uma quinta alternativa", async () => {
        const question = await createQuestion();
        await createAlternatives(question.id);
        await prisma.alternative.createMany({
            data: [
                { question_id: question.id, text: "Jaleco", correct: false },
                { question_id: question.id, text: "Máscara", correct: false }
            ]
        });
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: [{ questionId: question.id, text: "Calçado fechado", correct: false }]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A questão pode ter no máximo 4 alternativas");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(4);
    });

    test("deve rejeitar o cadastro sem correta ou com duas corretas", async () => {
        const question = await createQuestion();
        const withoutCorrect = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: false },
                { questionId: question.id, text: "Luvas", correct: false }
            ]
        });
        const twoCorrect = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: true },
                { questionId: question.id, text: "Luvas", correct: true }
            ]
        });

        expect(withoutCorrect.statusCode).toBe(400);
        expect(twoCorrect.statusCode).toBe(400);
        expect(withoutCorrect.json().message).toBe("A questão deve ter exatamente 1 alternativa correta");
        expect(twoCorrect.json().message).toBe("A questão deve ter exatamente 1 alternativa correta");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
    });

    test("deve impedir outra correta quando a questão já possui uma", async () => {
        const question = await createQuestion();
        await createAlternatives(question.id);
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: [{ questionId: question.id, text: "Jaleco", correct: true }]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A questão deve ter exatamente 1 alternativa correta");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
    });

    test("deve rejeitar alternativas de questões diferentes na mesma requisição", async () => {
        const question = await createQuestion();
        const otherQuestion = await createQuestion();
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: true },
                { questionId: otherQuestion.id, text: "Luvas", correct: false }
            ]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("As alternativas devem pertencer à mesma questão");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
        expect(await prisma.alternative.count({ where: { question_id: otherQuestion.id } })).toBe(0);
    });

    test("deve listar todas as alternativas e esconder correct do aluno", async () => {
        const question = await createQuestion();
        const { correctAlternative, incorrectAlternative } = await createAlternatives(question.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${studentToken}` }
        });

        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toContainEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text, correct: true });
        expect(teacherResponse.json()).toContainEqual({ id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text, correct: false });
        expect(studentResponse.json()).toContainEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text });
        expect(studentResponse.json()).toContainEqual({ id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text });
        for (const alternative of studentResponse.json()) {
            expect(alternative).not.toHaveProperty("correct");
        }
    });

    test("deve permitir a consulta pelo ID para professores e aluno", async () => {
        const question = await createQuestion();
        const { correctAlternative } = await createAlternatives(question.id);

        for (const token of [teacherToken, otherTeacherToken]) {
            const response = await app.inject({
                method: "GET",
                url: `/api/alternatives/${correctAlternative.id}`,
                headers: { authorization: `Bearer ${token}` }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text, correct: true });
        }

        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/alternatives/${correctAlternative.id}`,
            headers: { authorization: `Bearer ${studentToken}` }
        });
        expect(studentResponse.statusCode).toBe(200);
        expect(studentResponse.json()).toEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text });
    });

    test("deve listar somente as alternativas da questão informada", async () => {
        const question = await createQuestion();
        const { correctAlternative, incorrectAlternative } = await createAlternatives(question.id);
        const otherQuestion = await createQuestion();
        await createAlternatives(otherQuestion.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${studentToken}` }
        });

        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toEqual([
            { id: correctAlternative.id, questionId: question.id, text: correctAlternative.text, correct: true },
            { id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text, correct: false }
        ]);
        expect(studentResponse.json()).toEqual([
            { id: correctAlternative.id, questionId: question.id, text: correctAlternative.text },
            { id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text }
        ]);
    });

    test("deve retornar uma lista vazia para uma questão sem alternativas", async () => {
        const question = await createQuestion();
        const response = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${studentToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    test("deve esconder correct se o professor virar aluno mesmo com o token antigo", async () => {
        const question = await createQuestion();
        const { correctAlternative } = await createAlternatives(question.id);
        await prisma.usuario.update({ where: { id: otherTeacherId }, data: { role: user_role.Aluno_a_ } });

        try {
            const list = await app.inject({
                method: "GET",
                url: "/api/alternatives",
                headers: { authorization: `Bearer ${otherTeacherToken}` }
            });
            const byId = await app.inject({
                method: "GET",
                url: `/api/alternatives/${correctAlternative.id}`,
                headers: { authorization: `Bearer ${otherTeacherToken}` }
            });
            const byQuestion = await app.inject({
                method: "GET",
                url: `/api/questions/${question.id}/alternatives`,
                headers: { authorization: `Bearer ${otherTeacherToken}` }
            });

            expect(list.statusCode).toBe(200);
            expect(byId.statusCode).toBe(200);
            expect(byQuestion.statusCode).toBe(200);
            expect(byId.json()).toEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text });
            for (const alternative of list.json()) {
                expect(alternative).not.toHaveProperty("correct");
            }
            for (const alternative of byQuestion.json()) {
                expect(alternative).not.toHaveProperty("correct");
            }
        } finally {
            await prisma.usuario.update({ where: { id: otherTeacherId }, data: { role: user_role.Professor_a_ } });
        }
    });

    test("deve atualizar somente o texto e registrar o log", async () => {
        const question = await createQuestion();
        const otherQuestion = await createQuestion();
        const { incorrectAlternative } = await createAlternatives(question.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { text: "  Luvas de proteção  ", correct: true, questionId: otherQuestion.id }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: incorrectAlternative.id, questionId: question.id, text: "Luvas de proteção", correct: false });
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual({ ...incorrectAlternative, text: "Luvas de proteção" });
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "ALTERACAO_ALTERNATIVA", description: { contains: `alternativa de ID ${incorrectAlternative.id} na questão` } }
        })).toBe(1);
    });

    test("deve trocar a correta sem alterar as alternativas de outra questão", async () => {
        const question = await createQuestion();
        const { correctAlternative, incorrectAlternative } = await createAlternatives(question.id);
        const otherQuestion = await createQuestion();
        const otherAlternatives = await createAlternatives(otherQuestion.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text, correct: true });
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual({ ...correctAlternative, correct: false });
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual({ ...incorrectAlternative, correct: true });
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
        expect(await prisma.alternative.findUnique({ where: { id: otherAlternatives.correctAlternative.id } })).toEqual(otherAlternatives.correctAlternative);
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "ALTERACAO_ALTERNATIVA_CORRETA", description: { endsWith: `para a alternativa de ID ${incorrectAlternative.id}` } }
        })).toBe(1);
    });

    test("deve excluir uma incorreta, manter duas alternativas e registrar o log", async () => {
        const question = await createQuestion();
        const { correctAlternative, incorrectAlternative } = await createAlternatives(question.id);
        await prisma.alternative.create({ data: { question_id: question.id, text: "Jaleco", correct: false } });
        const response = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toBeNull();
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual(correctAlternative);
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "EXCLUSAO_ALTERNATIVA", description: { contains: `alternativa de ID ${incorrectAlternative.id} da questão` } }
        })).toBe(1);
    });

    test("deve impedir uma exclusão que deixe menos de duas alternativas", async () => {
        const question = await createQuestion();
        const { incorrectAlternative } = await createAlternatives(question.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json().message).toBe("A questão deve ter no mínimo 2 alternativas");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "EXCLUSAO_ALTERNATIVA", description: { contains: `alternativa de ID ${incorrectAlternative.id} da questão` } }
        })).toBe(0);
    });

    test("deve impedir a exclusão da única correta", async () => {
        const question = await createQuestion();
        const { correctAlternative } = await createAlternatives(question.id);
        await prisma.alternative.create({ data: { question_id: question.id, text: "Jaleco", correct: false } });
        const response = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${correctAlternative.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json().message).toBe("A questão deve manter exatamente 1 alternativa correta");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(3);
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual(correctAlternative);
    });

    test("deve remover as alternativas ao excluir a questão", async () => {
        const question = await createQuestion();
        await createAlternatives(question.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(response.statusCode).toBe(204);
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
    });

    test("deve impedir outro professor de cadastrar, editar, trocar a correta ou excluir", async () => {
        const question = await createQuestion();
        const { correctAlternative, incorrectAlternative } = await createAlternatives(question.id);
        await prisma.alternative.create({ data: { question_id: question.id, text: "Jaleco", correct: false } });
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${otherTeacherToken}` },
            payload: [{ questionId: question.id, text: "Máscara", correct: false }]
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${otherTeacherToken}` },
            payload: { text: "Alteração indevida" }
        });
        const change = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${otherTeacherToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${otherTeacherToken}` }
        });

        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(change.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(post.json().message).toBe("Você pode somente criar alternativas nos seus próprios quizzes");
        expect(patch.json().message).toBe("Você pode somente atualizar alternativas dos seus próprios quizzes");
        expect(change.json().message).toBe("Você pode somente alterar a alternativa correta dos seus próprios quizzes");
        expect(remove.json().message).toBe("Você só pode excluir alternativas dos seus próprios quizzes");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(3);
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual(correctAlternative);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({
            where: { user_id: otherTeacherId, action: { in: ["CADASTRO_ALTERNATIVA", "ALTERACAO_ALTERNATIVA", "ALTERACAO_ALTERNATIVA_CORRETA", "EXCLUSAO_ALTERNATIVA"] } }
        })).toBe(0);
    });

    test("deve impedir alterações por alunos e registrar as tentativas", async () => {
        const question = await createQuestion();
        const { incorrectAlternative } = await createAlternatives(question.id);
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${studentToken}` },
            payload: [{ questionId: question.id, text: "Jaleco", correct: false }]
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${studentToken}` },
            payload: { text: "Alteração indevida" }
        });
        const change = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${studentToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${studentToken}` }
        });

        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(change.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({ where: { user_id: studentId, action: "FALHA_AUTORIZACAO" } })).toBe(4);
    });

    test("deve impedir o administrador em todas as rotas", async () => {
        const question = await createQuestion();
        const { incorrectAlternative } = await createAlternatives(question.id);
        const list = await app.inject({
            method: "GET",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const byQuestion = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${adminToken}` },
            payload: [{ questionId: question.id, text: "Jaleco", correct: false }]
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { text: "Alteração indevida" }
        });
        const change = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${adminToken}` }
        });

        expect(list.statusCode).toBe(403);
        expect(byId.statusCode).toBe(403);
        expect(byQuestion.statusCode).toBe(403);
        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(change.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({ where: { user_id: adminId, action: "FALHA_AUTORIZACAO" } })).toBe(7);
    });

    test("deve rejeitar todas as rotas sem token, com token inválido ou expirado", async () => {
        const question = await createQuestion();
        const { incorrectAlternative } = await createAlternatives(question.id);
        const expiredToken = app.jwt.sign({ sub: teacherId, role: UserRole.PROFESSOR }, { expiresIn: -1 });

        for (const token of ["", "token-invalido", expiredToken]) {
            const headers = token ? { authorization: `Bearer ${token}` } : {};
            const list = await app.inject({ method: "GET", url: "/api/alternatives", headers });
            const byId = await app.inject({ method: "GET", url: `/api/alternatives/${incorrectAlternative.id}`, headers });
            const byQuestion = await app.inject({ method: "GET", url: `/api/questions/${question.id}/alternatives`, headers });
            const post = await app.inject({
                method: "POST",
                url: "/api/alternatives",
                headers,
                payload: [{ questionId: question.id, text: "Jaleco", correct: false }]
            });
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/alternatives/${incorrectAlternative.id}`,
                headers,
                payload: { text: "Alteração indevida" }
            });
            const change = await app.inject({ method: "PATCH", url: `/api/alternatives/${incorrectAlternative.id}/correct`, headers });
            const remove = await app.inject({ method: "DELETE", url: `/api/alternatives/${incorrectAlternative.id}`, headers });

            expect(list.statusCode).toBe(401);
            expect(byId.statusCode).toBe(401);
            expect(byQuestion.statusCode).toBe(401);
            expect(post.statusCode).toBe(401);
            expect(patch.statusCode).toBe(401);
            expect(change.statusCode).toBe(401);
            expect(remove.statusCode).toBe(401);
        }

        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
    });

    test("deve rejeitar IDs inválidos nas rotas", async () => {
        for (const id of ["0", "-1", "1.5", "abc"]) {
            const headers = { authorization: `Bearer ${teacherToken}` };
            const byId = await app.inject({ method: "GET", url: `/api/alternatives/${id}`, headers });
            const byQuestion = await app.inject({ method: "GET", url: `/api/questions/${id}/alternatives`, headers });
            const patch = await app.inject({ method: "PATCH", url: `/api/alternatives/${id}`, headers, payload: { text: "Luvas" } });
            const change = await app.inject({ method: "PATCH", url: `/api/alternatives/${id}/correct`, headers });
            const remove = await app.inject({ method: "DELETE", url: `/api/alternatives/${id}`, headers });

            expect(byId.statusCode).toBe(400);
            expect(byQuestion.statusCode).toBe(400);
            expect(patch.statusCode).toBe(400);
            expect(change.statusCode).toBe(400);
            expect(remove.statusCode).toBe(400);
            expect(byId.json().message).toBe("ID inválido");
            expect(byQuestion.json().message).toBe("ID inválido");
            expect(patch.json().message).toBe("ID inválido");
            expect(change.json().message).toBe("ID inválido");
            expect(remove.json().message).toBe("ID inválido");
        }
    });

    test("deve rejeitar corpos inválidos no cadastro", async () => {
        const question = await createQuestion();
        const invalidBodies = [
            {},
            [],
            [{ text: "Luvas", correct: false }],
            [{ questionId: String(question.id), text: "Luvas", correct: false }],
            [{ questionId: question.id, text: "   ", correct: false }],
            [{ questionId: question.id, text: "Luvas", correct: "false" }],
            [{ questionId: question.id, text: "Luvas" }]
        ];

        for (const payload of invalidBodies) {
            const response = await app.inject({
                method: "POST",
                url: "/api/alternatives",
                headers: { authorization: `Bearer ${teacherToken}` },
                payload
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Dados inválidos");
        }

        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
    });

    test("deve rejeitar corpos inválidos na atualização", async () => {
        const question = await createQuestion();
        const { incorrectAlternative } = await createAlternatives(question.id);

        for (const payload of [{}, { text: "   " }, { text: 123 }, { correct: true }, { questionId: question.id }]) {
            const response = await app.inject({
                method: "PATCH",
                url: `/api/alternatives/${incorrectAlternative.id}`,
                headers: { authorization: `Bearer ${teacherToken}` },
                payload
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Dados inválidos");
        }

        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
    });

    test("deve tratar uma alternativa e uma questão inexistentes", async () => {
        const question = await createQuestion();
        const { incorrectAlternative } = await createAlternatives(question.id);
        await prisma.question.delete({ where: { id: question.id } });
        const headers = { authorization: `Bearer ${teacherToken}` };
        const byId = await app.inject({ method: "GET", url: `/api/alternatives/${incorrectAlternative.id}`, headers });
        const byQuestion = await app.inject({ method: "GET", url: `/api/questions/${question.id}/alternatives`, headers });
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers,
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: true },
                { questionId: question.id, text: "Luvas", correct: false }
            ]
        });
        const patch = await app.inject({ method: "PATCH", url: `/api/alternatives/${incorrectAlternative.id}`, headers, payload: { text: "Luvas" } });
        const change = await app.inject({ method: "PATCH", url: `/api/alternatives/${incorrectAlternative.id}/correct`, headers });
        const remove = await app.inject({ method: "DELETE", url: `/api/alternatives/${incorrectAlternative.id}`, headers });

        expect(byId.statusCode).toBe(404);
        expect(byQuestion.statusCode).toBe(404);
        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(change.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(byId.json().message).toBe("Alternativa não encontrada");
        expect(byQuestion.json().message).toBe("Questão não encontrada");
        expect(post.json().message).toBe("Questão não encontrada");
        expect(patch.json().message).toBe("Alternativa não encontrada");
        expect(change.json().message).toBe("Alternativa não encontrada");
        expect(remove.json().message).toBe("Alternativa não encontrada");
    });
});