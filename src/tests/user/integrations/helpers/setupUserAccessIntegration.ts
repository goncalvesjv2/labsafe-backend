/// <reference types="jest" />
import "dotenv/config";
import { beforeEach } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { app } from "../../../../app";
import { prisma } from "../../../../database/prisma";
import { user_role } from "../../../../generated/prisma/enums";
import { UserRole } from "../../../../utils/user";
import { createLogService } from "../../../../services/logService";
import type { setupUserIntegration } from "./setupUserIntegration";
import type { IUserFormat } from "../../../../interfaces/IUserFormat";

const originalCreateLogService = jest.requireActual<typeof import("../../../../services/logService")>("../../../../services/logService").createLogService;

export function setupUserAccessIntegration(context: ReturnType<typeof setupUserIntegration>) {
    let admin: IUserFormat;
    let user: IUserFormat;
    let adminToken: string;

    beforeEach(async () => {
        jest.mocked(createLogService).mockReset();
        jest.mocked(createLogService).mockImplementation(originalCreateLogService);

        admin = await prisma.usuario.create({
            data: { name: "Admin Teste", email: `admin.status.${randomUUID()}@example.com`, senha: context.passwordHash, role: user_role.Admin }
        });

        user = await prisma.usuario.create({
            data: { name: "Aluno Teste", email: `aluno.status.${randomUUID()}@example.com`, senha: context.passwordHash, role: user_role.Aluno_a_ }
        });
        adminToken = app.jwt.sign({ sub: admin.id, role: UserRole.ADMIN });
    });

    async function changeStatus(ativo: boolean) {
        return app.inject({
            method: "PATCH", url: `/api/users/${user.id}/status`,
            headers: { authorization: `Bearer ${adminToken}` }, payload: { ativo }
        });
    }

    async function loginUser() {
        return app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password: context.password } });
    }

    async function countStatusLogs() {
        return prisma.logs.count({ where: { user_id: admin.id, action: "ALTERACAO_STATUS_USUARIO" } });
    }

    return {
        get admin() { return admin; },
        get user() { return user; },
        get adminToken() { return adminToken; },
        changeStatus,
        loginUser,
        countStatusLogs
    };
}
