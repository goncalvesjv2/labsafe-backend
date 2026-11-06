import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";

describe("Testes de integração do quiz", () => {
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
        try {
            await prisma.quiz.deleteMany({ where: { conteudo: { usuario: { email: { in: emails } } } } });
            await prisma.conteudo.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            await Promise.all([app.close(), prisma.$disconnect()]);
        }
    }, 30000);

    test("deve cadastrar um quiz em um conteúdo próprio e registrar o log", async () => {
        const content = await createContent();
        const response = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: content.id, teacherId: otherTeacherId, id: 999 }
        });
        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({ id: expect.any(Number), contentId: content.id, teacherId });
        const savedQuiz = await prisma.quiz.findUniqueOrThrow({ where: { id: body.id } });
        expect(savedQuiz.conteudo_id).toBe(content.id);
        expect(savedQuiz.professor_id).toBe(teacherId);
        const logs = await prisma.logs.findMany({
            where: { user_id: teacherId, action: "CADASTRO_QUIZ", description: { contains: `quiz de ID ${body.id} ` } }
        });
        expect(logs).toHaveLength(1);
    }, 30000);

    test("deve permitir que professor e aluno listem os quizzes", async () => {
        const { content, quiz } = await createQuizFixture();
        for (const token of [teacherToken, studentToken]) {
            const response = await app.inject({
                method: "GET",
                url: "/api/quizzes",
                headers: { authorization: `Bearer ${token}` }
            });
            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body).toContainEqual({ id: quiz.id, contentId: content.id, teacherId });
        }
    }, 30000);

    test("deve permitir que professor e aluno consultem um quiz pelo ID", async () => {
        const { content, quiz } = await createQuizFixture();
        for (const token of [teacherToken, studentToken]) {
            const response = await app.inject({
                method: "GET",
                url: `/api/quizzes/${quiz.id}`,
                headers: { authorization: `Bearer ${token}` }
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ id: quiz.id, contentId: content.id, teacherId });
        }
    }, 30000);

    test("deve trocar o conteúdo do quiz mantendo seu ID e registrar o log", async () => {
        const { content, quiz } = await createQuizFixture();
        const targetContent = await createContent();
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: targetContent.id, teacherId: otherTeacherId }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: quiz.id, contentId: targetContent.id, teacherId });
        const savedQuiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quiz.id } });
        expect(savedQuiz.conteudo_id).toBe(targetContent.id);
        expect(savedQuiz.professor_id).toBe(teacherId);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: content.id } })).toBeNull();
        const logs = await prisma.logs.findMany({
            where: { user_id: teacherId, action: "ALTERACAO_QUIZ", description: { contains: `quiz de ID ${quiz.id},` } }
        });
        expect(logs).toHaveLength(1);
    }, 30000);

    test("deve permitir manter o conteúdo atual sem criar outro quiz", async () => {
        const { content, quiz } = await createQuizFixture();
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: content.id }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: quiz.id, contentId: content.id, teacherId });
        expect(await prisma.quiz.count({ where: { conteudo_id: content.id } })).toBe(1);
    }, 30000);

    test("deve excluir o quiz, preservar o conteúdo e registrar o log", async () => {
        const { content, quiz } = await createQuizFixture();
        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
        expect(await prisma.conteudo.findUnique({ where: { id: content.id } })).not.toBeNull();
        const logs = await prisma.logs.findMany({
            where: { user_id: teacherId, action: "EXCLUSAO_QUIZ", description: { contains: `quiz de ID ${quiz.id} ` } }
        });
        expect(logs).toHaveLength(1);
    }, 30000);

    test("deve rejeitar todas as rotas sem token", async () => {
        const totalBefore = await countQuizzes();
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes"
        });
        expect(listResponse.statusCode).toBe(401);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1"
        });
        expect(byIdResponse.statusCode).toBe(401);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1"
        });
        expect(removeResponse.statusCode).toBe(401);
        expect(await countQuizzes()).toBe(totalBefore);
    }, 30000);

    test("deve rejeitar um token inválido em todas as rotas", async () => {
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: "Bearer token-invalido" }
        });
        expect(listResponse.statusCode).toBe(401);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: "Bearer token-invalido" }
        });
        expect(byIdResponse.statusCode).toBe(401);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: "Bearer token-invalido" },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: "Bearer token-invalido" },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: "Bearer token-invalido" }
        });
        expect(removeResponse.statusCode).toBe(401);
    }, 30000);

    test("deve rejeitar um token expirado em todas as rotas", async () => {
        const expiredToken = app.jwt.sign({ sub: teacherId, role: UserRole.PROFESSOR }, { expiresIn: -1 });
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${expiredToken}` }
        });
        expect(listResponse.statusCode).toBe(401);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${expiredToken}` }
        });
        expect(byIdResponse.statusCode).toBe(401);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${expiredToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${expiredToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${expiredToken}` }
        });
        expect(removeResponse.statusCode).toBe(401);
    }, 30000);

    test("deve bloquear o administrador em todas as rotas e registrar as tentativas", async () => {
        const totalBefore = await countQuizzes();
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        expect(listResponse.statusCode).toBe(403);
        const listBody = listResponse.json();
        expect(listBody.message).toBe("Somente professores e alunos podem acessar os quizzes");
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        expect(byIdResponse.statusCode).toBe(403);
        const byIdBody = byIdResponse.json();
        expect(byIdBody.message).toBe("Somente professores e alunos podem acessar os quizzes");
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(403);
        const postBody = postResponse.json();
        expect(postBody.message).toBe("Somente professores podem executar esta ação");
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(403);
        const patchBody = patchResponse.json();
        expect(patchBody.message).toBe("Somente professores podem executar esta ação");
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${adminToken}` }
        });
        expect(removeResponse.statusCode).toBe(403);
        const removeBody = removeResponse.json();
        expect(removeBody.message).toBe("Somente professores podem executar esta ação");
        expect(await countQuizzes()).toBe(totalBefore);
        const logs = await prisma.logs.findMany({ where: { user_id: adminId, action: "FALHA_AUTORIZACAO" } });
        expect(logs).toHaveLength(5);
    }, 30000);

    test("deve impedir que o aluno cadastre, atualize ou exclua quizzes", async () => {
        const { quiz } = await createQuizFixture();
        const targetContent = await createContent();
        const totalBefore = await countQuizzes();
        const post = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${studentToken}` },
            payload: { contentId: targetContent.id }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${studentToken}` },
            payload: { contentId: targetContent.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${studentToken}` }
        });
        expect(post.statusCode).toBe(403);
        expect(patch.statusCode).toBe(403);
        expect(remove.statusCode).toBe(403);
        expect(await countQuizzes()).toBe(totalBefore);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: targetContent.id } })).toBeNull();
        expect(await prisma.logs.count({ where: { user_id: studentId, action: "FALHA_AUTORIZACAO" } })).toBe(3);
    }, 30000);

    test("deve rejeitar o token de um usuário excluído", async () => {
        const user = await prisma.usuario.create({
            data: { name: "Aluno excluído", email: deletedUserEmail, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        const oldToken = await login(deletedUserEmail);
        await prisma.logs.deleteMany({ where: { user_id: user.id } });
        await prisma.usuario.delete({ where: { id: user.id } });
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(listResponse.statusCode).toBe(401);
        expect(listResponse.json().message).toBe("Usuário não encontrado");
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(byIdResponse.statusCode).toBe(401);
        expect(byIdResponse.json().message).toBe("Usuário não encontrado");
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(401);
        expect(postResponse.json().message).toBe("Usuário não encontrado");
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(401);
        expect(patchResponse.json().message).toBe("Usuário não encontrado");
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(removeResponse.statusCode).toBe(401);
        expect(removeResponse.json().message).toBe("Usuário não encontrado");
    }, 30000);

    test("deve bloquear o token antigo de aluno após mudança para administrador", async () => {
        const user = await prisma.usuario.create({
            data: { name: "Aluno com perfil alterado", email: changedRoleEmail, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        const oldToken = await login(changedRoleEmail);
        await prisma.usuario.update({ where: { id: user.id }, data: { role: user_role.Admin } });
        const listResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(listResponse.statusCode).toBe(403);
        const byIdResponse = await app.inject({
            method: "GET",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(byIdResponse.statusCode).toBe(403);
        const postResponse = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(postResponse.statusCode).toBe(403);
        const patchResponse = await app.inject({
            method: "PATCH",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` },
            payload: { contentId: 1 }
        });
        expect(patchResponse.statusCode).toBe(403);
        const removeResponse = await app.inject({
            method: "DELETE",
            url: "/api/quizzes/1",
            headers: { authorization: `Bearer ${oldToken}` }
        });
        expect(removeResponse.statusCode).toBe(403);
    }, 30000);

    test("deve rejeitar IDs inválidos na consulta, edição e exclusão", async () => {
        const totalBefore = await countQuizzes();
        for (const id of ["0", "-1", "1.5", "abc", "Infinity"]) {
            const getResponse = await app.inject({
                method: "GET",
                url: `/api/quizzes/${id}`,
                headers: { authorization: `Bearer ${teacherToken}` }
            });
            expect(getResponse.statusCode).toBe(400);
            expect(getResponse.json()).toEqual({ message: "ID inválido" });
            const patchResponse = await app.inject({
                method: "PATCH",
                url: `/api/quizzes/${id}`,
                headers: { authorization: `Bearer ${teacherToken}` }
            });
            expect(patchResponse.statusCode).toBe(400);
            expect(patchResponse.json()).toEqual({ message: "ID inválido" });
            const removeResponse = await app.inject({
                method: "DELETE",
                url: `/api/quizzes/${id}`,
                headers: { authorization: `Bearer ${teacherToken}` }
            });
            expect(removeResponse.statusCode).toBe(400);
            expect(removeResponse.json()).toEqual({ message: "ID inválido" });
        }
        expect(await countQuizzes()).toBe(totalBefore);
    }, 30000);

    test("deve rejeitar corpos inválidos no cadastro e na atualização", async () => {
        const { quiz } = await createQuizFixture();
        const totalBefore = await countQuizzes();
        const invalidBodies = [{}, { contentId: null }, { contentId: "1" }, { contentId: true },
            { contentId: 0 }, { contentId: -1 }, { contentId: 1.5 }];
        for (const body of invalidBodies) {
            const post = await app.inject({
                method: "POST",
                url: "/api/quizzes",
                headers: { authorization: `Bearer ${teacherToken}` },
                payload: body
            });
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/quizzes/${quiz.id}`,
                headers: { authorization: `Bearer ${teacherToken}` },
                payload: body
            });
            expect(post.statusCode).toBe(400);
            expect(patch.statusCode).toBe(400);
            expect(post.json().message).toBe("Dados inválidos");
            expect(patch.json().message).toBe("Dados inválidos");
        }
        expect(await countQuizzes()).toBe(totalBefore);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
    }, 30000);

    test("deve rejeitar cadastro e atualização para um conteúdo inexistente", async () => {
        const missingContent = await createContent();
        await prisma.conteudo.delete({ where: { id: missingContent.id } });
        const { quiz } = await createQuizFixture();
        const totalBefore = await countQuizzes();
        const post = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: missingContent.id }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: missingContent.id }
        });
        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(post.json().message).toBe("Conteúdo não encontrado");
        expect(patch.json().message).toBe("Conteúdo não encontrado");
        expect(await countQuizzes()).toBe(totalBefore);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
    }, 30000);

    test("deve impedir um segundo quiz para o mesmo conteúdo", async () => {
        const { content, quiz } = await createQuizFixture();
        const response = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: content.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Este conteúdo já possui um quiz");
        expect(await prisma.quiz.findMany({ where: { conteudo_id: content.id } })).toEqual([quiz]);
    }, 30000);

    test("deve impedir a troca para um conteúdo que já possui outro quiz", async () => {
        const original = await createQuizFixture();
        const target = await createQuizFixture();
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${original.quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: target.content.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Este conteúdo já possui um quiz");
        expect(await prisma.quiz.findUnique({ where: { id: original.quiz.id } })).toEqual(original.quiz);
        expect(await prisma.quiz.findUnique({ where: { id: target.quiz.id } })).toEqual(target.quiz);
    }, 30000);

    test("deve impedir o cadastro em conteúdo de outro professor", async () => {
        const content = await createContent(otherTeacherId);
        const response = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: content.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Você pode somente criar quizzes para seus próprios conteúdos");
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: content.id } })).toBeNull();
    }, 30000);

    test("deve impedir a edição e a exclusão do quiz de outro professor", async () => {
        const { quiz } = await createQuizFixture(otherTeacherId);
        const targetContent = await createContent();
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: targetContent.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        expect(patch.statusCode).toBe(400);
        expect(patch.json().message).toBe("Você pode somente atualizar seus próprios quizzes");
        expect(remove.statusCode).toBe(500);
        expect(remove.json().message).toBe("Você só pode excluir seus próprios quizzes");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: targetContent.id } })).toBeNull();
    }, 30000);

    test("deve impedir mover o próprio quiz para conteúdo de outro professor", async () => {
        const { quiz } = await createQuizFixture();
        const targetContent = await createContent(otherTeacherId);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: targetContent.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Você pode somente vincular quizzes aos seus próprios conteúdos");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: targetContent.id } })).toBeNull();
    }, 30000);

    test("deve usar o criador do quiz para autorizar edição e exclusão", async () => {
        const { quiz, content } = await createQuizFixture();
        const savedQuiz = await prisma.quiz.update({
            where: { id: quiz.id },
            data: { professor_id: otherTeacherId }
        });

        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: content.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });

        expect(patch.statusCode).toBe(400);
        expect(patch.json().message).toBe("Você pode somente atualizar seus próprios quizzes");
        expect(remove.statusCode).toBe(500);
        expect(remove.json().message).toBe("Você só pode excluir seus próprios quizzes");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(savedQuiz);
    }, 30000);

    test("deve tratar consulta, edição e exclusão de um quiz inexistente", async () => {
        const { quiz, content } = await createQuizFixture();
        await prisma.quiz.delete({ where: { id: quiz.id } });
        const get = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` },
            payload: { contentId: content.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${teacherToken}` }
        });
        expect(get.statusCode).toBe(404);
        expect(patch.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(get.json().message).toBe("Quiz não encontrado");
        expect(patch.json().message).toBe("Quiz não encontrado");
        expect(remove.json().message).toBe("Quiz não encontrado");
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: content.id } })).toBeNull();
    }, 30000);
});
