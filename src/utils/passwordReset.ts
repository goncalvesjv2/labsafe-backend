import { createHash, randomBytes } from "node:crypto";

export function generatePasswordReset(url: string) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const passwordResetUrl = new URL("/reset-password", url);
    passwordResetUrl.searchParams.set("type", "recovery");
    passwordResetUrl.searchParams.set("token", token);

    return {
        token,
        tokenHash,
        expiresAt,
        passwordResetUrl: passwordResetUrl.toString()
    };
}
