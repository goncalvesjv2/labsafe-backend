import { afterAll, beforeAll, beforeEach } from "@jest/globals";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { app } from "../../../../app";
import { prisma } from "../../../../database/prisma";
import { user_role } from "../../../../generated/prisma/enums";
import { sendEmailService } from "../../../../services/emailService";
import { createLogService } from "../../../../services/logService";

const originalCreateLogService = jest.requireActual<typeof import("../../../../services/logService")>("../../../../services/logService").createLogService;

export function setupPasswordResetIntegration() {
    const password = "SenhaTeste123!";
    const newPassword = "NovaSenha123!";
    const genericResponse = {
        message: "Se houver uma conta apta à recuperação com esse e-mail, você receberá as instruções."
    };

    let passwordHash: string;
    let userId: number;
    let email: string;

    beforeAll(async () => {
        app.log.level = "silent";
        await app.ready();
        passwordHash = await bcrypt.hash(password, 10);
    }, 30000);

    beforeEach(async () => {
        jest.mocked(sendEmailService).mockReset();
        jest.mocked(sendEmailService).mockResolvedValue({ messageId: "email-teste" });
        jest.mocked(createLogService).mockReset();
        jest.mocked(createLogService).mockImplementation(originalCreateLogService);

        email = `recuperacao.${randomUUID()}@example.com`;
        const user = await prisma.usuario.create({
            data: { name: "Aluno Recuperação", email, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        userId = user.id;
    });

    afterAll(async () => {
        await Promise.all([app.close(), prisma.$disconnect()]);
    }, 30000);

    async function requestRecovery(value = email) {
        return app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: value } });
    }

    async function resetPassword(token: string) {
        return app.inject({
            method: "POST", url: "/auth/reset-password",
            payload: { token, password: newPassword, confirmPassword: newPassword }
        });
    }

    function getEmailToken(index = 0) {
        const sentEmail = jest.mocked(sendEmailService).mock.calls[index][0];
        const link = sentEmail.text.match(/http:\/\/localhost:5173\/reset-password\?type=recovery&token=[a-f0-9]{64}/);
        assert.ok(link);
        const token = new URL(link[0]).searchParams.get("token");
        assert.ok(token);
        return token;
    }

    return {
        get password() { return password; },
        get newPassword() { return newPassword; },
        get genericResponse() { return genericResponse; },
        get passwordHash() { return passwordHash; },
        get userId() { return userId; },
        get email() { return email; },
        get requestRecovery() { return requestRecovery; },
        get resetPassword() { return resetPassword; },
        get getEmailToken() { return getEmailToken; }
    };
}
