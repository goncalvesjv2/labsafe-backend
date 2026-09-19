import { ICreateUser } from "../interfaces/IUser";
import { createUserRepository, deleteUserRepository, listUserByEmailRepository, listUserByIdRepository, listUsersRepository, updateUserRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";

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

export async function createUserService(user: ICreateUser) {
    const isExistUser = await listUserByEmailRepository(user.email);

    if (!user.name || !user.email || !user.password || !user.role) {
        throw new Error("Todos os campos são obrigatórios");
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ALUNO && user.role !== UserRole.PROFESSOR) {
        throw new Error("Esse role não é válido");
    }

    if (isExistUser) {
        throw new Error("Usuário já possui cadastro");
    }

    const createUser = await createUserRepository(user);
    return createUser;
}

export async function updateUserService(id: number, user: ICreateUser) {
    const updateUser = await updateUserRepository(id, user);

    if (!user.name || !user.email || !user.password || !user.role) {
        throw new Error("Todos os campos são obrigatórios");
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ALUNO && user.role !== UserRole.PROFESSOR) {
        throw new Error("Esse role não é válido");
    }

    if (!updateUser) {
        throw new Error("Usuário não encontrado");
    }

    return updateUser;
}

export async function deleteUserService(id: number) {
    const deleteUser = await deleteUserRepository(id);
    
    if (!deleteUser) {
        throw new Error("Usuário não encontrado");
    }

    return deleteUser;
}