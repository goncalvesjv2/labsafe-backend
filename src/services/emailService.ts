import { mailTransporter } from "../config/mail";
import type { IEmail } from "../interfaces/IEmail";

export async function sendEmailService(email: IEmail) {
    const sentEmail = await mailTransporter.sendMail({
        to: email.to,
        subject: email.subject,
        text: email.text
    });

    return { messageId: sentEmail.messageId };
}
