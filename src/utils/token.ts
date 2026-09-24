import { app } from "../app";
import { IUser } from "../interfaces/IUser";

export function generateToken(user: IUser) {
    const token = app.jwt.sign({
        sub: user.id,
        role: user.role
    });

    return { token };
}