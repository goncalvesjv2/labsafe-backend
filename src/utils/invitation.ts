import { createHash, randomBytes } from "node:crypto";

export function generateInvitation(url: string) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const invitationUrl = new URL("/reset-password", url);
    invitationUrl.searchParams.set("type", "invitation");
    invitationUrl.searchParams.set("token", token);

    return {
        token,
        tokenHash,
        expiresAt,
        invitationUrl: invitationUrl.toString()
    };
}
