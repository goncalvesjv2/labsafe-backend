import { app } from "../app";
import { IToken } from "../interfaces/IToken";

export function generateToken(user: IToken) {
    const token = app.jwt.sign({
        sub: user.id,
        name: user.name,
        role: user.role
    }, {
        expiresIn: "1h"
    });

    return { token };
}