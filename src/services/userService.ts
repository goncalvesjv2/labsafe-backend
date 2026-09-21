import { ICreateUser } from "../interfaces/IUser";
import { createUserRepository, deleteUserRepository, listUserByEmailRepository, listUserByIdRepository, listUsersRepository, updateUserRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import bcrypt from "bcrypt";

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
    return createUser;
}

export async function updateUserService(id: number, user: ICreateUser) {
    if (!user.name || !user.email || !user.password || !user.role) {
        throw new Error("Todos os campos são obrigatórios");
    }
    
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ALUNO && user.role !== UserRole.PROFESSOR) {
        throw new Error("Esse role não é válido");
    }
    
    const passwordHash = await bcrypt.hash(user.password, 10);
    const updateUser = await updateUserRepository(id, user, passwordHash);
    
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