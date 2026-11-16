import { ICreateUser } from "../interfaces/IUser";
import { acceptUserInvitationRepository, changeUserStatusRepository, createUserRepository, deleteUserRepository, findUserByInvitationRepository, listUserByEmailRepository, listUserByIdRepository, listUsersRepository, resendUserInvitationRepository, saveUserInvitationRepository, updateUserRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import bcrypt from "bcrypt";
import { createLogService } from "./logService";
import type { UpdateUser } from "../schemas/userSchema";
import { prisma } from "../database/prisma";
import { generateInvitation } from "../utils/invitation";
import { sendEmailService } from "./emailService";
import { createHash } from "node:crypto";

export async function listUsersService() {
    const users = await listUsersRepository();
    return users;
}

export async function listUserByIdService(id: number) {
    const user = await listUserByIdRepository(id);

    if (!user) {
        throw new Error("Usuário não encontrado");
    }

    return user;
}

export async function createUserService(user: ICreateUser, userId: number) {  
    const isExistUser = await listUserByEmailRepository(user.email);
    
    if (isExistUser) {
        throw new Error("Usuário já possui cadastro");
    }

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
        throw new Error("A variável FRONTEND_URL não foi definida");
    }

    const invitation = generateInvitation(frontendUrl);

    const createdUser = await prisma.$transaction(async (transaction) => {
        const createUser = await createUserRepository(user, transaction);
        const savedInvitation = await saveUserInvitationRepository(createUser.id, invitation.tokenHash, invitation.expiresAt, transaction);

        if (!savedInvitation) {
            throw new Error("Convite não foi salvo");
        }

        await createLogService({
            userId: userId,
            action: "CADASTRO_USUARIO",
            description: `Usuário com o e-mail ${createUser.email} foi cadastrado`
        }, transaction);

        return createUser;
    });

    try {
        await sendEmailService({
            to: createdUser.email,
            subject: "LabSafe - Crie sua senha",
            text: `Olá, ${createdUser.name}!\n\nSua conta no LabSafe foi cadastrada. Crie sua senha pelo link:\n${invitation.invitationUrl}\n\nO convite é válido por 5 minutos a partir de sua geração.`
        });

        return { ...createdUser, invitationSent: true };
    } catch {
        return {
            ...createdUser,
            invitationSent: false,
            message: "Usuário cadastrado, mas o e-mail não foi enviado. Será necessário reenviar o convite."
        };
    }
}

export async function resendUserInvitationService(id: number, userId: number) {
    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
        throw new Error("A variável FRONTEND_URL não foi definida");
    }

    const invitation = generateInvitation(frontendUrl);

    const invitedUser = await prisma.$transaction(async (transaction) => {
        const admin = await listUserByIdRepository(userId, transaction);

        if (!admin || !admin.ativo || admin.role !== UserRole.ADMIN) {
            throw new Error("Somente administradores ativos podem reenviar convites");
        }

        const user = await listUserByIdRepository(id, transaction);

        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        if (!user.ativo) {
            throw new Error("Usuário inativo");
        }

        const updatedUser = await resendUserInvitationRepository(id, invitation.tokenHash, invitation.expiresAt, transaction);

        if (!updatedUser) {
            throw new Error("O convite só pode ser reenviado para usuários ativos sem senha definida");
        }

        await createLogService({
            userId,
            action: "REENVIO_CONVITE",
            description: `Novo convite gerado para o usuário com o e-mail ${updatedUser.email}`
        }, transaction);

        return updatedUser;
    });

    try {
        await sendEmailService({
            to: invitedUser.email,
            subject: "LabSafe - Crie sua senha",
            text: `Olá, ${invitedUser.name}!\n\nCrie sua senha pelo novo link:\n${invitation.invitationUrl}\n\nO convite é válido por 5 minutos a partir de sua geração. O link anterior não é mais válido.`
        });

        return { invitationSent: true, message: "Convite reenviado com sucesso." };
    } catch {
        return {
            invitationSent: false,
            message: "Novo convite salvo, mas o e-mail não foi enviado. Será necessário reenviar o convite."
        };
    }
}

export async function acceptUserInvitationService(token: string, password: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await findUserByInvitationRepository(tokenHash);

    if (!user || !user.invitation_expires_at || user.invitation_expires_at <= new Date()) {
        throw new Error("Convite inválido ou expirado");
    }

    if (!user.ativo) {
        throw new Error("Usuário inativo");
    }

    if (user.senha !== null) {
        throw new Error("A senha já foi definida");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.$transaction(async (transaction) => {
        const updatedUser = await acceptUserInvitationRepository(tokenHash, passwordHash, transaction);

        if (!updatedUser) {
            throw new Error("Convite inválido ou expirado");
        }

        await createLogService({
            userId: updatedUser.id,
            action: "ACEITE_CONVITE",
            description: "Usuário definiu a senha pelo convite"
        }, transaction);

        return { message: "Senha criada com sucesso. Faça login para acessar o sistema." };
    });
}

export async function updateUserService(id: number, user: UpdateUser, userId: number) {
    if (!user.name || !user.email || !user.role) {
        throw new Error("Nome, e-mail e cargo são obrigatórios");
    }
    
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ALUNO && user.role !== UserRole.PROFESSOR) {
        throw new Error("Esse role não é válido");
    }

    if (id === userId) {
        const currentUser = await listUserByIdService(id);

        if (user.role !== currentUser.role) {
            throw new Error("Você não pode alterar seu próprio cargo");
        }
    }

    return prisma.$transaction(async (transaction) => {
        const updateUser = await updateUserRepository(id, user, transaction);

        if (!updateUser) {
            throw new Error("Usuário não encontrado");
        }

        await createLogService({
            userId: userId,
            action: "ALTERACAO_USUARIO",
            description: `O usuário com o e-mail ${updateUser.email} foi atualizado`
        }, transaction);

        return updateUser;
    });
}

export async function changeUserStatusService(id: number, ativo: boolean, userId: number) {
    if (id === userId && !ativo) {
        throw new Error("Você não pode desativar sua própria conta");
    }

    return prisma.$transaction(async (transaction) => {
        const admin = await listUserByIdRepository(userId, transaction);

        if (!admin) {
            throw new Error("Usuário não encontrado");
        }

        if (!admin.ativo || admin.role !== UserRole.ADMIN) {
            throw new Error("Somente administradores ativos podem alterar o status de usuários");
        }

        const user = await listUserByIdRepository(id, transaction);

        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        if (user.ativo === ativo) {
            return user;
        }

        const updatedUser = await changeUserStatusRepository(id, ativo, transaction);

        if (!updatedUser) {
            throw new Error("Usuário não encontrado");
        }

        await createLogService({
            userId,
            action: "ALTERACAO_STATUS_USUARIO",
            description: `O usuário com o e-mail ${updatedUser.email} foi ${ativo ? "ativado" : "desativado"}`
        }, transaction);

        return updatedUser;
    });
}

export async function deleteUserService(id: number, userId: number) {
    if (id === userId) {
        throw new Error("Você não pode excluir sua própria conta");
    }

    const deleteUser = await deleteUserRepository(id);
    
    if (!deleteUser) {
        throw new Error("Usuário não encontrado");
    }

    return deleteUser;
}
