import { findUserByPasswordResetRepository, listUserByEmailRepository, resetPasswordRepository, savePasswordResetRepository } from "../repositories/userRepository";
import { generatePasswordReset } from "../utils/passwordReset";
import { sendEmailService } from "./emailService";
import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../database/prisma";
import { createLogService } from "./logService";

export async function forgotPasswordService(email: string) {
    const response = {
        message: "Se houver uma conta apta à recuperação com esse e-mail, você receberá as instruções."
    };

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
        throw new Error("A variável FRONTEND_URL não foi definida");
    }

    const user = await listUserByEmailRepository(email.trim().toLowerCase());

    if (!user || !user.ativo || !user.senha) {
        return response;
    }

    const passwordReset = generatePasswordReset(frontendUrl);
    const updatedUser = await savePasswordResetRepository(user.id, passwordReset.tokenHash, passwordReset.expiresAt);

    if (!updatedUser) {
        return response;
    }

    try {
        await sendEmailService({
            to: updatedUser.email,
            subject: "LabSafe - Recuperação de senha",
            text: `Olá, ${updatedUser.name}!\n\nRecebemos uma solicitação para redefinir sua senha. Acesse o link:\n${passwordReset.passwordResetUrl}\n\nO link é válido por 5 minutos a partir de sua geração. Se você não solicitou a recuperação, ignore este e-mail.`
        });
    } catch {
        console.error("Falha ao enviar o e-mail de recuperação de senha.");
    }

    return response;
}

export async function resetPasswordService(token: string, password: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await findUserByPasswordResetRepository(tokenHash);

    if (!user || !user.password_reset_expires_at || user.password_reset_expires_at <= new Date()) {
        throw new Error("Link de recuperação inválido ou expirado");
    }

    if (!user.ativo) {
        throw new Error("Usuário inativo");
    }

    if (!user.senha) {
        throw new Error("A senha ainda não foi definida");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.$transaction(async (transaction) => {
        const updatedUser = await resetPasswordRepository(tokenHash, passwordHash, transaction);

        if (!updatedUser) {
            throw new Error("Link de recuperação inválido ou expirado");
        }

        await createLogService({
            userId: updatedUser.id,
            action: "REDEFINICAO_SENHA",
            description: "Usuário redefiniu a senha pela recuperação"
        }, transaction);

        return { message: "Senha redefinida com sucesso. Faça login para acessar o sistema." };
    });
}
