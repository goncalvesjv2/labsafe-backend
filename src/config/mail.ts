import "dotenv/config";
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_SECURE || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    throw new Error("Configurações de e-mail incompletas");
}

const port = Number(SMTP_PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT deve ser uma porta válida entre 1 e 65535.");
}

if (SMTP_SECURE !== "true" && SMTP_SECURE !== "false") {
    throw new Error("SMTP_SECURE deve ser true ou false.");
}

export const mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE === "true",
    requireTLS: true,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
}, {
    from: MAIL_FROM
});
