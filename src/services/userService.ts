import { ICreateUser } from "../interfaces/IUser";
import { changeUserStatusRepository, createUserRepository, deleteUserRepository, listUserByEmailRepository, listUserByIdRepository, listUsersRepository, updateUserRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import bcrypt from "bcrypt";
import { createLogService } from "./logService";
import type { UpdateUser } from "../schemas/userSchema";
import { prisma } from "../database/prisma";

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

    const passwordHash = await bcrypt.hash(user.password, 10);

    const createUser = await createUserRepository(user, passwordHash);

    await createLogService({
        userId: userId,
        action: "CADASTRO_USUARIO",
        description: `Usuário com o e-mail ${createUser.email} foi cadastrado`
    });

    return createUser;
}

export async function updateUserService(id: number, user: UpdateUser, userId: number) {
    if (!user.name || !user.email || !user.role) {
        throw new Error("Nome, e-mail e cargo são obrigatórios");
    }
    
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ALUNO && user.role !== UserRole.PROFESSOR) {
        throw new Error("Esse role não é válido");
    }

    let passwordHash = "";
    
    if (user.password) {
        passwordHash = await bcrypt.hash(user.password, 10);
    }

    const updateUser = await updateUserRepository(id, user, passwordHash);
    
    if (!updateUser) {
        throw new Error("Usuário não encontrado");
    }
    
    await createLogService({
        userId: userId,
        action: "ALTERACAO_USUARIO",
        description: `O usúario com o e-mail ${updateUser.email} foi atualizado`
    });

    return updateUser;
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
