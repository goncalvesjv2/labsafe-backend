import { UserRole } from "../utils/user";

export interface IPayload {
    sub: number;
    role: UserRole;
}