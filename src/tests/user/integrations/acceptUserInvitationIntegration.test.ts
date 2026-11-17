/// <reference types="jest" />
import "dotenv/config";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { createLogService } from "../../../services/logService";
import { acceptUserInvitationService } from "../../../services/userService";
import { generateInvitation } from "../../../utils/invitation";
import { setupUserIntegration } from "./helpers/setupUserIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

jest.mock("../../../services/logService", () => {
    const original = jest.requireActual<typeof import("../../../services/logService")>("../../../services/logService");
    return { ...original, createLogService: jest.fn(original.createLogService) };
});

const originalCreateLogService = jest.requireActual<typeof import("../../../services/logService")>("../../../services/logService").createLogService;

describe("Teste de integração de usuários", () => {
    const context = setupUserIntegration();

    describe("Aceite do convite", () => {
        let invitationToken: string;
        let invitedUserId: number;

        beforeEach(async () => {
            jest.mocked(createLogService).mockReset();
            jest.mocked(createLogService).mockImplementation(originalCreateLogService);

            const invitation = generateInvitation("http://localhost:5173");
            invitationToken = invitation.token;
            const user = await prisma.usuario.create({
                data: {
                    name: "Aluno Convidado",
                    email: `aceite.${randomUUID()}@example.com`,
                    role: user_role.Aluno_a_,
                    senha: null,
                    invitation_token_hash: invitation.tokenHash,
                    invitation_expires_at: invitation.expiresAt
                }
            });
            invitedUserId = user.id;
        });

        test("Convite válido salva a senha com bcrypt, apaga o convite e registra o log", async () => {
            const result = await acceptUserInvitationService(invitationToken, context.password);
            expect(result).toEqual({ message: "Senha criada com sucesso. Faça login para acessar o sistema." });

            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            assert.ok(user.senha);
            expect(await bcrypt.compare(context.password, user.senha)).toBe(true);
            expect(user.invitation_token_hash).toBeNull();
            expect(user.invitation_expires_at).toBeNull();
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(1);
        });

        test("Convite inexistente não permite definir a senha", async () => {
            await expect(acceptUserInvitationService("0".repeat(64), context.password)).rejects.toThrow("Convite inválido ou expirado");
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            expect(user.senha).toBeNull();
            expect(user.invitation_token_hash).not.toBeNull();
        });

        test("Convite expirado não permite definir a senha", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { invitation_expires_at: new Date(Date.now() - 1000) } });
            await expect(acceptUserInvitationService(invitationToken, context.password)).rejects.toThrow("Convite inválido ou expirado");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBeNull();
        });

        test("Convite sem validade não permite definir a senha", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { invitation_expires_at: null } });
            await expect(acceptUserInvitationService(invitationToken, context.password)).rejects.toThrow("Convite inválido ou expirado");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBeNull();
        });

        test("Conta inativa não permite aceitar o convite", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { ativo: false } });
            await expect(acceptUserInvitationService(invitationToken, context.password)).rejects.toThrow("Usuário inativo");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBeNull();
        });

        test("Convite não altera uma senha que já foi definida", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { senha: context.passwordHash } });
            await expect(acceptUserInvitationService(invitationToken, "OutraSenha123!")).rejects.toThrow("A senha já foi definida");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBe(context.passwordHash);
        });

        test("Convite usado não pode ser aceito novamente", async () => {
            await acceptUserInvitationService(invitationToken, context.password);
            await expect(acceptUserInvitationService(invitationToken, "OutraSenha123!")).rejects.toThrow("Convite inválido ou expirado");
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(1);
        });

        test("Duas tentativas simultâneas só conseguem aceitar o convite uma vez", async () => {
            const results = await Promise.allSettled([
                acceptUserInvitationService(invitationToken, context.password),
                acceptUserInvitationService(invitationToken, context.password)
            ]);
            expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
            expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(1);
        });

        test("Falha no log desfaz a senha e mantém o convite disponível", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));

            await expect(acceptUserInvitationService(invitationToken, context.password)).rejects.toThrow("Falha ao salvar log");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(0);
            await expect(acceptUserInvitationService(invitationToken, context.password)).resolves.toHaveProperty("message");
        });
    });
});
