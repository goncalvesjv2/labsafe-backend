import { ICreateUser } from "../interfaces/IUser";
import { prisma } from "../database/prisma";
import { Prisma } from "../generated/prisma/client";
import { user_role } from "../generated/prisma/enums";
import { UserRole, formatUser } from "../utils/user";
import type { UpdateUser } from "../schemas/userSchema";

const role = {
    [UserRole.ADMIN]: user_role.Admin,
    [UserRole.ALUNO]: user_role.Aluno_a_,
    [UserRole.PROFESSOR]: user_role.Professor_a_
};

export async function listUsersRepository() {
    const users = await prisma.usuario.findMany();
    return users.map(formatUser);
}

export async function listUserByIdRepository(id: number) {
    const user = await prisma.usuario.findUnique({
        where: { id },
    });

    if (!user) {
        return null;
    }

    return formatUser(user);
}

export async function listUserByEmailRepository(email: string) {
    return prisma.usuario.findUnique({
        where: { email },
    });
}

export async function createUserRepository(user: ICreateUser, password: string) {
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

export async function updateUserRepository(id: number, user: UpdateUser, password: string) {
    try {
        const updatedUser = await prisma.usuario.update({
            where: { id },
            data: {
                name: user.name,
                email: user.email,
                senha: password || undefined,
                role: role[user.role]
            },
        });

        return formatUser(updatedUser);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return null;
        }

        throw error;
    }
}

export async function deleteUserRepository(id: number) {
    return prisma.usuario.delete({
        where: { id },
    })
}
