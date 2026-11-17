import { describe, expect, test } from "@jest/globals";
import { user_role } from "../../../generated/prisma/enums";
import { formatUser, UserRole } from "../../../utils/user";

describe("Password status in public user responses", () => {
    test.each([
        { senha: null, hasPassword: false },
        { senha: "password-hash-fixture", hasPassword: true },
    ])("returns hasPassword=$hasPassword without exposing credentials", ({ senha, hasPassword }) => {
        const user = {
            id: 7,
            name: "Test User",
            email: "user@example.test",
            role: user_role.Aluno_a_,
            ativo: true,
            senha,
            invitation_token_hash: "invitation-hash-fixture",
            password_reset_token_hash: "reset-hash-fixture",
        };

        expect(formatUser(user)).toEqual({
            id: 7,
            name: "Test User",
            email: "user@example.test",
            role: UserRole.ALUNO,
            ativo: true,
            hasPassword,
        });
    });
});
