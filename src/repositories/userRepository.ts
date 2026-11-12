import type { ICreateUser, IUserResponse } from "../interfaces/IUser";
import type { IUserFormat } from "../interfaces/IUserFormat";
import { prisma } from "../database/prisma";
import { user_role } from "../generated/prisma/enums";
import { UserRole, formatUser } from "../utils/user";
import type { UpdateUser } from "../schemas/userSchema";

const role = {
    [UserRole.ADMIN]: user_role.Admin,
    [UserRole.ALUNO]: user_role.Aluno_a_,
    [UserRole.PROFESSOR]: user_role.Professor_a_
};

export async function listUsersRepository(): Promise<IUserResponse[]> {
    const users = await prisma.usuario.findMany();
    return users.map(formatUser);
}

export async function listUserByIdRepository(id: number): Promise<IUserResponse | null> {
    const user = await prisma.usuario.findUnique({
        where: { id },
    });

    return user ? formatUser(user) : null;
}

export async function listUserByEmailRepository(email: string): Promise<IUserFormat | null> {
    return prisma.usuario.findUnique({
        where: { email },
    });
}

export async function createUserRepository(user: ICreateUser, password: string): Promise<IUserResponse> {
    const newUser = await prisma.usuario.create({
        data: {
            name: user.name,
            email: user.email,
            senha: password,
            role: role[user.role],
        },
    });

    return formatUser(newUser);
}

export async function updateUserRepository(id: number, user: UpdateUser, password: string): Promise<IUserResponse | null> {
    const updatedUsers = await prisma.usuario.updateManyAndReturn({
        where: { id },
        data: {
            name: user.name,
            email: user.email,
            senha: password || undefined,
            role: role[user.role]
        },
    });

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function deleteUserRepository(id: number): Promise<IUserFormat> {
    return prisma.usuario.delete({
        where: { id },
    })
}
