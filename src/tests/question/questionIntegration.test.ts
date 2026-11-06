import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";

describe("Testes de integração de questões", () => {
    let teacherId: number;
    let otherTeacherId: number;
    let studentId: number;
    let adminId: number;
    let teacherToken: string;
    let otherTeacherToken: string;
    let studentToken: string;
    let adminToken: string;
    const password = "SenhaTeste123!";
    const teacherEmail = `professor.question.${randomUUID()}@example.com`;
    const otherTeacherEmail = `outro.professor.question.${randomUUID()}@example.com`;
    const studentEmail = `aluno.question.${randomUUID()}@example.com`;
    const adminEmail = `admin.question.${randomUUID()}@example.com`;
    const emails = [teacherEmail, otherTeacherEmail, studentEmail, adminEmail];

    async function login(email: string) {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.token).toEqual(expect.any(String));
        return body.token;
    }

    async function createQuiz(professorId = teacherId) {
        const content = await prisma.conteudo.create({
            data: {
                professor_id: professorId,
                title: "Conteúdo das questões",
                description: "Orientações de segurança no laboratório."
            }
        });

        return prisma.quiz.create({
            data: { conteudo_id: content.id, professor_id: professorId }
        });
    }

    async function createQuestion(quizId: number) {
        return prisma.question.create({
            data: { quiz_id: quizId, statement: "Quando utilizar luvas?" }
        });
    }

    async function createQuestions(quizId: number, total: number) {
        for (let i = 0; i < total; i++) {
            await createQuestion(quizId);
        }
    }

    beforeAll(async () => {
        app.log.level = "silent";
        await app.ready();
        const passwordHash = await bcrypt.hash(password, 10);
        const teacher = await prisma.usuario.create({
            data: { name: "Professor das Questões", email: teacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        teacherId = teacher.id;
        const otherTeacher = await prisma.usuario.create({
            data: { name: "Outro Professor", email: otherTeacherEmail, senha: passwordHash, role: user_role.Professor_a_ }
        });
        otherTeacherId = otherTeacher.id;
        const student = await prisma.usuario.create({
            data: { name: "Aluno das Questões", email: studentEmail, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        studentId = student.id;
        const admin = await prisma.usuario.create({
            data: { name: "Admin das Questões", email: adminEmail, senha: passwordHash, role: user_role.Admin }
        });
        adminId = admin.id;
        teacherToken = await login(teacherEmail);
        otherTeacherToken = await login(otherTeacherEmail);
        studentToken = await login(studentEmail);
        adminToken = await login(adminEmail);
    }, 30000);

    afterAll(async () => {
        try {
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

    test("deve cadastrar a primeira questão, remover espaços e registrar o log", async () => {
        const quiz = await createQuiz();
        const response = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: {
                quizId: quiz.id,
                statement: "  Quando utilizar luvas?  ",
                id: 999,
                teacherId: otherTeacherId
            }
        });

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({ id: expect.any(Number), quizId: quiz.id, statement: "Quando utilizar luvas?" });
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: body.id } });
        expect(savedQuestion.quiz_id).toBe(quiz.id);
        expect(savedQuestion.statement).toBe("Quando utilizar luvas?");
        const logs = await prisma.logs.findMany({
            where: { user_id: teacherId, action: "CADASTRO_QUESTAO", description: { contains: `questão de ID ${body.id} no quiz` } }
        });
        expect(logs).toHaveLength(1);
    });

    test("deve permitir que professor e aluno listem todas as questões", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${studentToken}` }
        });
        const expectedQuestion = { id: question.id, quizId: quiz.id, statement: question.statement };
        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toContainEqual(expectedQuestion);
        expect(studentResponse.json()).toContainEqual(expectedQuestion);
    });

    test("deve permitir que professor, outro professor e aluno consultem uma questão", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const otherTeacherResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${otherTeacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${studentToken}` }
        });
        const expectedQuestion = { id: question.id, quizId: quiz.id, statement: question.statement };
        expect(teacherResponse.statusCode).toBe(200);
        expect(otherTeacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toEqual(expectedQuestion);
        expect(otherTeacherResponse.json()).toEqual(expectedQuestion);
        expect(studentResponse.json()).toEqual(expectedQuestion);
    });

    test("deve listar somente as questões do quiz informado em ordem de ID", async () => {
        const quiz = await createQuiz();
        const otherQuiz = await createQuiz();
        const first = await createQuestion(quiz.id);
        await createQuestion(otherQuiz.id);
        const second = await createQuestion(quiz.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/questions`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/questions`,
            headers: { authorization: `Bearer ${studentToken}` }
        });
        const expectedQuestions = [
            { id: first.id, quizId: quiz.id, statement: first.statement },
            { id: second.id, quizId: quiz.id, statement: second.statement }
        ];
        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toEqual(expectedQuestions);
        expect(studentResponse.json()).toEqual(expectedQuestions);
    });

    test("deve retornar uma lista vazia para um quiz sem questões", async () => {
        const quiz = await createQuiz();
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/questions`,
            headers: { authorization: `Bearer ${studentToken}` }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    test("deve atualizar somente o enunciado e registrar o log", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: {
                statement: "  Quando utilizar óculos?  ", teacherId: otherTeacherId
            }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Quando utilizar óculos?" });
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
        expect(savedQuestion.statement).toBe("Quando utilizar óculos?");
        expect(savedQuestion.quiz_id).toBe(quiz.id);
        const logs = await prisma.logs.findMany({
            where: { user_id: teacherId, action: "ALTERACAO_QUESTAO", description: { contains: `questão de ID ${question.id},` } }
        });
        expect(logs).toHaveLength(1);
    });

    test("deve mover a questão para outro quiz próprio com nove questões", async () => {
        const quiz = await createQuiz();
        const targetQuiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        await createQuestions(targetQuiz.id, 9);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: targetQuiz.id }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: question.id, quizId: targetQuiz.id, statement: question.statement });
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
        expect(savedQuestion.quiz_id).toBe(targetQuiz.id);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(0);
        expect(await prisma.question.count({ where: { quiz_id: targetQuiz.id } })).toBe(10);
    });

    test("deve editar uma questão mantendo o mesmo quiz com dez questões", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        await createQuestions(quiz.id, 9);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: {
                quizId: quiz.id, statement: "Nova pergunta"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Nova pergunta" });
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(10);
    });

    test("deve excluir a questão, preservar o quiz e registrar o log", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        const logs = await prisma.logs.findMany({
            where: { user_id: teacherId, action: "EXCLUSAO_QUESTAO", description: { contains: `questão de ID ${question.id} do quiz` } }
        });
        expect(logs).toHaveLength(1);
    });

    test("deve remover as questões ao excluir o quiz", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        expect(response.statusCode).toBe(204);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
        expect(await prisma.conteudo.findUnique({ where: { id: quiz.conteudo_id } })).not.toBeNull();
    });

    test("deve permitir cadastrar a décima questão", async () => {
        const quiz = await createQuiz();
        await createQuestions(quiz.id, 9);
        const response = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: quiz.id, statement: "Décima pergunta" }
        });
        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({ id: expect.any(Number), quizId: quiz.id, statement: "Décima pergunta" });
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(10);
    });

    test("deve impedir cadastrar a décima primeira questão sem registrar sucesso", async () => {
        const quiz = await createQuiz();
        await createQuestions(quiz.id, 10);
        const response = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: quiz.id, statement: "Outra pergunta" }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("O quiz pode ter no máximo 10 questões");
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(10);
        expect(await prisma.logs.count({
            where: { user_id: teacherId, action: "CADASTRO_QUESTAO", description: { endsWith: `no quiz de ID ${quiz.id}` } }
        })).toBe(0);
    });

    test("deve impedir mover uma questão para um quiz com dez questões", async () => {
        const quiz = await createQuiz();
        const targetQuiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        await createQuestions(targetQuiz.id, 10);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: targetQuiz.id }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("O quiz pode ter no máximo 10 questões");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: targetQuiz.id } })).toBe(10);
    });

    test("deve rejeitar dados inválidos no cadastro e na atualização", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const invalidBodies = [
            {},
            { quizId: "1", statement: "Pergunta" },
            { quizId: 0, statement: "Pergunta" },
            { quizId: -1, statement: "Pergunta" },
            { quizId: 1.5, statement: "Pergunta" },
            { quizId: null, statement: "Pergunta" },
            { quizId: quiz.id, statement: "" },
            { quizId: quiz.id, statement: "   " },
            { quizId: quiz.id, statement: 123 }
        ];

        for (const body of invalidBodies) {
            const post = await app.inject({
                method: "POST",
                url: "/api/questions",
                headers: { authorization: `Bearer ${teacherToken}` },
                payload: body
            });
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/questions/${question.id}`,
                headers: { authorization: `Bearer ${teacherToken}` },
                payload: body
            });
            expect(post.statusCode).toBe(400);
            expect(patch.statusCode).toBe(400);
            expect(post.json().message).toBe("Dados inválidos");
            expect(patch.json().message).toBe("Dados inválidos");
        }
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
    });

    test("deve exigir quiz e enunciado no cadastro", async () => {
        const quiz = await createQuiz();
        const withoutQuiz = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { statement: "Pergunta" }
        });
        const withoutStatement = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: quiz.id }
        });

        expect(withoutQuiz.statusCode).toBe(400);
        expect(withoutStatement.statusCode).toBe(400);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(0);
    });

    test("deve rejeitar IDs inválidos nas consultas, edição e exclusão", async () => {
        for (const id of ["0", "-1", "1.5", "abc", "Infinity"]) {
            const get = await app.inject({
                method: "GET",
                url: `/api/questions/${id}`,
                headers: { authorization: `Bearer ${teacherToken}` }
            });
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/questions/${id}`,
                headers: { authorization: `Bearer ${teacherToken}` }
            });
            const remove = await app.inject({
                method: "DELETE",
                url: `/api/questions/${id}`,
                headers: { authorization: `Bearer ${teacherToken}` }
            });
            const byQuiz = await app.inject({
                method: "GET",
                url: `/api/quizzes/${id}/questions`,
                headers: { authorization: `Bearer ${teacherToken}` }
            });

            expect(get.statusCode).toBe(400);
            expect(patch.statusCode).toBe(400);
            expect(remove.statusCode).toBe(400);
            expect(byQuiz.statusCode).toBe(400);
            expect(get.json().message).toBe("ID inválido");
            expect(patch.json().message).toBe("ID inválido");
            expect(remove.json().message).toBe("ID inválido");
            expect(byQuiz.json().message).toBe("ID inválido");
        }
    });

    test("deve tratar consulta, edição e exclusão de uma questão inexistente", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        await prisma.question.delete({ where: { id: question.id } });
        const get = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { statement: "Nova pergunta" }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        expect(get.statusCode).toBe(404);
        expect(patch.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(get.json().message).toBe("Questão não encontrada");
        expect(patch.json().message).toBe("Questão não encontrada");
        expect(remove.json().message).toBe("Questão não encontrada");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
    });

    test("deve rejeitar consulta, cadastro e transferência para um quiz inexistente", async () => {
        const missingQuiz = await createQuiz();
        await prisma.quiz.delete({ where: { id: missingQuiz.id } });
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const get = await app.inject({
            method: "GET",
            url: `/api/quizzes/${missingQuiz.id}/questions`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: missingQuiz.id, statement: "Pergunta" }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: missingQuiz.id }
        });

        expect(get.statusCode).toBe(404);
        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(get.json().message).toBe("Quiz não encontrado");
        expect(post.json().message).toBe("Quiz não encontrado");
        expect(patch.json().message).toBe("Quiz não encontrado");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
    });

    test("deve impedir outro professor de cadastrar, editar ou excluir questões do quiz", async () => {
        const quiz = await createQuiz();
        const ownQuizOfOtherTeacher = await createQuiz(otherTeacherId);
        const question = await createQuestion(quiz.id);
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${otherTeacherToken}` },
            payload: { quizId: quiz.id, statement: "Pergunta" }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${otherTeacherToken}` },
            payload: {
                quizId: ownQuizOfOtherTeacher.id, statement: "Pergunta alterada"
            }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${otherTeacherToken}` }
        });

        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(post.json().message).toBe("Você pode somente criar questões nos seus próprios quizzes");
        expect(patch.json().message).toBe("Você pode somente atualizar suas próprias questões");
        expect(remove.json().message).toBe("Você só pode excluir suas próprias questões");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.question.count({ where: { quiz_id: ownQuizOfOtherTeacher.id } })).toBe(0);
    });

    test("deve impedir mover uma questão própria para o quiz de outro professor", async () => {
        const quiz = await createQuiz();
        const targetQuiz = await createQuiz(otherTeacherId);
        const question = await createQuestion(quiz.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { quizId: targetQuiz.id }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Você pode somente vincular questões aos seus próprios quizzes");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: targetQuiz.id } })).toBe(0);
    });

    test("deve verificar o criador do quiz mesmo se o professor do conteúdo mudar", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        await prisma.conteudo.update({ where: { id: quiz.conteudo_id }, data: { professor_id: otherTeacherId } });

        const denied = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${otherTeacherToken}` },
            payload: { statement: "Alteração indevida" }
        });
        expect(denied.statusCode).toBe(400);
        expect(denied.json().message).toBe("Você pode somente atualizar suas próprias questões");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);

        const allowed = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { statement: "Alteração do criador" }
        });
        expect(allowed.statusCode).toBe(200);
        expect(allowed.json()).toEqual({ id: question.id, quizId: quiz.id, statement: "Alteração do criador" });
        const savedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
        expect(savedQuestion.statement).toBe("Alteração do criador");
    });

    test("deve rejeitar todas as rotas sem token", async () => {
        const list = await app.inject({
            method: "GET",
            url: "/api/questions"
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1"
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions"
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions"
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1"
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1"
        });

        expect(list.statusCode).toBe(401);
        expect(byId.statusCode).toBe(401);
        expect(byQuiz.statusCode).toBe(401);
        expect(post.statusCode).toBe(401);
        expect(patch.statusCode).toBe(401);
        expect(remove.statusCode).toBe(401);
    });

    test("deve rejeitar um token inválido em todas as rotas", async () => {
        const token = "token-invalido";
        const list = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(list.statusCode).toBe(401);
        expect(byId.statusCode).toBe(401);
        expect(byQuiz.statusCode).toBe(401);
        expect(post.statusCode).toBe(401);
        expect(patch.statusCode).toBe(401);
        expect(remove.statusCode).toBe(401);
    });

    test("deve rejeitar um token expirado em todas as rotas", async () => {
        const token = app.jwt.sign({ sub: teacherId, role: UserRole.PROFESSOR }, { expiresIn: -1 });
        const list = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${token}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(list.statusCode).toBe(401);
        expect(byId.statusCode).toBe(401);
        expect(byQuiz.statusCode).toBe(401);
        expect(post.statusCode).toBe(401);
        expect(patch.statusCode).toBe(401);
        expect(remove.statusCode).toBe(401);
    });

    test("deve bloquear o administrador em todas as rotas e registrar as tentativas", async () => {
        const list = await app.inject({
            method: "GET",
            url: "/api/questions",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const byId = await app.inject({
            method: "GET",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const byQuiz = await app.inject({
            method: "GET",
            url: "/api/quizzes/1/questions",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: "/api/questions/1",
            headers: { authorization: `Bearer ${adminToken}` }
        });

        expect(list.statusCode).toBe(403);
        expect(byId.statusCode).toBe(403);
        expect(byQuiz.statusCode).toBe(403);
        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        const logs = await prisma.logs.findMany({ where: { user_id: adminId, action: "FALHA_AUTORIZACAO" } });
        expect(logs).toHaveLength(6);
    });

    test("deve impedir que o aluno cadastre, edite ou exclua questões", async () => {
        const quiz = await createQuiz();
        const question = await createQuestion(quiz.id);
        const post = await app.inject({
            method: "POST",
            url: "/api/questions",
            headers: { authorization: `Bearer ${studentToken}` },
            payload: { quizId: quiz.id, statement: "Pergunta" }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${studentToken}` },
            payload: { statement: "Nova pergunta" }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${studentToken}` }
        });

        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toEqual(question);
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(1);
        expect(await prisma.logs.count({ where: { user_id: studentId, action: "FALHA_AUTORIZACAO" } })).toBe(3);
    });
});