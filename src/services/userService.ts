import { ICreateUser } from "../interfaces/IUser";
import { createUserRepository, deleteUserRepository, listUserByEmailRepository, listUserByIdRepository, listUsersRepository, updateUserRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import bcrypt from "bcrypt";
import { createLogService } from "./logService";

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
    if (!user.name || !user.email || !user.password || !user.role) {
        throw new Error("Todos os campos são obrigatórios");
    }
    
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ALUNO && user.role !== UserRole.PROFESSOR) {
        throw new Error("Esse role não é válido");
    }
    
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

export async function updateUserService(id: number, user: ICreateUser, userId: number) {
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

export async function deleteUserService(id: number, userId: number) {
    const deleteUser = await deleteUserRepository(id);
    
    if (!deleteUser) {
        throw new Error("Usuário não encontrado");
    }

    await createLogService({
        userId: userId,
        action: "EXCLUSAO_USUARIO",
        description: `O usuário com e-mail ${deleteUser.email} foi excluído`
    });

    return deleteUser;
}