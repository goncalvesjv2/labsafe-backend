import bcrypt from 'bcrypt';
import { listUserByEmailRepository } from '../repositories/userRepository';
import { generateToken } from '../utils/token';

export async function loginService(email: string, password: string) {
    const isExistUser = await listUserByEmailRepository(email);

    if (!isExistUser) {
        throw new Error("E-mail ou senha inválidos");
    }

    const passwordValidate = await bcrypt.compare(password, isExistUser.senha);

    if (passwordValidate) {
        const token = generateToken(isExistUser);
        return token;
    } else {
        throw new Error("E-mail ou senha inválidos");
    }
}