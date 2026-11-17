import { jest, beforeAll, beforeEach, afterAll } from "@jest/globals";
import { UserRole } from "../../../../utils/user";
import type { IUserResponse } from "../../../../interfaces/IUser";

export function setupAuthIntegration() {
    const loginServiceMock = jest.fn<(email: string, password: string) => Promise<{ token: string }>>();
    const findUser = jest.fn<(id: number) => Promise<IUserResponse>>();
    const findAuthenticatedUser = jest.fn<(id: number) => Promise<IUserResponse | null>>();
    const deleteUser = jest.fn<(id: number) => Promise<unknown>>();
    const profile = {
        id: 7,
        name: "Usuário de teste",
        email: "perfil@example.com",
        role: UserRole.ALUNO,
        ativo: true,
    };

    let app: typeof import("../../../../app").app;

    beforeAll(async () => {
        jest.resetModules();

        jest.doMock("../../../../services/authService", () => ({
            loginService: loginServiceMock,
        }));
        jest.doMock("../../../../services/userService", () => ({
            ...jest.requireActual<typeof import("../../../../services/userService")>("../../../../services/userService"),
            listUserByIdService: findUser,
        }));
        jest.doMock("../../../../repositories/userRepository", () => ({
            ...jest.requireActual<typeof import("../../../../repositories/userRepository")>("../../../../repositories/userRepository"),
            listUserByIdRepository: findAuthenticatedUser,
            deleteUserRepository: deleteUser,
        }));

        const appModule = await import("../../../../app");
        app = appModule.app;

        await app.ready();
    });

    beforeEach(() => {
        loginServiceMock.mockReset();
        findUser.mockReset();
        findAuthenticatedUser.mockReset();
        findAuthenticatedUser.mockResolvedValue(profile);
        deleteUser.mockReset();
        deleteUser.mockResolvedValue(profile);
    });

    afterAll(async () => {
        try {
            if (app) {
                await app.close();
            }
        } finally {
            jest.dontMock("../../../../services/authService");
            jest.dontMock("../../../../services/userService");
            jest.dontMock("../../../../repositories/userRepository");
        }
    });

    return {
        get loginServiceMock() { return loginServiceMock; },
        get findUser() { return findUser; },
        get findAuthenticatedUser() { return findAuthenticatedUser; },
        get deleteUser() { return deleteUser; },
        get profile() { return profile; },
        get app() { return app; }
    };
}
