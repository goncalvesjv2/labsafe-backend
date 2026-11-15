import { listUserByEmailRepository, savePasswordResetRepository } from "../repositories/userRepository";
import { generatePasswordReset } from "../utils/passwordReset";
import { sendEmailService } from "./emailService";

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