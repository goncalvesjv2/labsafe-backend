import { ICreateUser } from "../interfaces/IUser";
import { prisma } from "../database/prisma";
import { user_role } from "../generated/prisma/enums";
import { UserRole } from "../utils/user";

const role = {
    [UserRole.ADMIN]: user_role.Admin,
    [UserRole.ALUNO]: user_role.Aluno_a_,
    [UserRole.PROFESSOR]: user_role.Professor_a_
};

export async function listUsersRepository() {
    return prisma.usuario.findMany();
}

export async function listUserByIdRepository(id: number) {
    return prisma.usuario.findUnique({
        where: { id },
    });
}

export async function listUserByEmailRepository(email: string) {
    return prisma.usuario.findUnique({
        where: { email },
    });
}

export async function createUserRepository(user: ICreateUser, password: string) {    
    return prisma.usuario.create({
        data: {
            name: user.name,
            email: user.email,
            senha: password,
            role: role[user.role],
        },
    });
}

export async function updateUserRepository(id: number, user: ICreateUser, password: string) {
    return prisma.usuario.update({
        where: { id },
        data: {
            name: user.name,
            email: user.email,
            senha: password || undefined,
            role: role[user.role] 
        },
    });
}

export async function deleteUserRepository(id: number) {
    return prisma.usuario.delete({
        where: { id },
    })
}