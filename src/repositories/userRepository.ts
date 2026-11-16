import type { ICreateUser, IUserResponse } from "../interfaces/IUser";
import type { IUserFormat } from "../interfaces/IUserFormat";
import { prisma } from "../database/prisma";
import type { Prisma } from "../generated/prisma/client";
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

export async function listUserByIdRepository(id: number, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const user = await transaction.usuario.findUnique({
        where: { id },
    });

    return user ? formatUser(user) : null;
}

export async function listUserByEmailRepository(email: string): Promise<IUserFormat | null> {
    return prisma.usuario.findUnique({
        where: { email },
    });
}

export async function findUserByInvitationRepository(tokenHash: string, transaction: Prisma.TransactionClient = prisma) {
    return transaction.usuario.findUnique({
        where: { invitation_token_hash: tokenHash }
    });
}

export async function findUserByPasswordResetRepository(tokenHash: string, transaction: Prisma.TransactionClient = prisma) {
    return transaction.usuario.findUnique({
        where: { password_reset_token_hash: tokenHash }
    });
}

export async function createUserRepository(user: ICreateUser, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse> {
    const newUser = await transaction.usuario.create({
        data: {
            name: user.name,
            email: user.email,
            senha: null,
            role: role[user.role],
        },
    });

    return formatUser(newUser);
}

export async function updateUserRepository(id: number, user: UpdateUser, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const data = {
        name: user.name,
        email: user.email,
        role: role[user.role]
    };

    let updatedUsers = await transaction.usuario.updateManyAndReturn({
        where: { id, email: user.email },
        data
    });

    if (updatedUsers.length === 0) {
        updatedUsers = await transaction.usuario.updateManyAndReturn({
            where: { id, email: { not: user.email } },
            data: {
                ...data,
                invitation_token_hash: null,
                invitation_expires_at: null,
                password_reset_token_hash: null,
                password_reset_expires_at: null
            }
        });
    }

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function changeUserStatusRepository(id: number, ativo: boolean, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const updatedUsers = await transaction.usuario.updateManyAndReturn({
        where: { id },
        data: { ativo },
    });

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function saveUserInvitationRepository(id: number, tokenHash: string, expiresAt: Date, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const updatedUsers = await transaction.usuario.updateManyAndReturn({
        where: { id },
        data: {
            invitation_token_hash: tokenHash,
            invitation_expires_at: expiresAt
        }
    });

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function resendUserInvitationRepository(id: number, tokenHash: string, expiresAt: Date, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const updatedUsers = await transaction.usuario.updateManyAndReturn({
        where: { id, ativo: true, senha: null },
        data: {
            invitation_token_hash: tokenHash,
            invitation_expires_at: expiresAt
        }
    });

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function acceptUserInvitationRepository(tokenHash: string, passwordHash: string, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const updatedUsers = await transaction.usuario.updateManyAndReturn({
        where: {
            invitation_token_hash: tokenHash,
            invitation_expires_at: { gt: new Date() },
            ativo: true,
            senha: null
        },
        data: {
            senha: passwordHash,
            invitation_token_hash: null,
            invitation_expires_at: null
        }
    });

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function savePasswordResetRepository(id: number, tokenHash: string, expiresAt: Date, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const updatedUsers = await transaction.usuario.updateManyAndReturn({
        where: { id, ativo: true, senha: { not: null } },
        data: {
            password_reset_token_hash: tokenHash,
            password_reset_expires_at: expiresAt
        }
    });

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function resetPasswordRepository(tokenHash: string, passwordHash: string, transaction: Prisma.TransactionClient = prisma): Promise<IUserResponse | null> {
    const updatedUsers = await transaction.usuario.updateManyAndReturn({
        where: {
            password_reset_token_hash: tokenHash,
            password_reset_expires_at: { gt: new Date() },
            ativo: true,
            senha: { not: null }
        },
        data: {
            senha: passwordHash,
            password_reset_token_hash: null,
            password_reset_expires_at: null
        }
    });

    const updatedUser = updatedUsers[0];
    return updatedUser ? formatUser(updatedUser) : null;
}

export async function deleteUserRepository(id: number): Promise<IUserFormat> {
    return prisma.usuario.delete({
        where: { id },
    })
}
