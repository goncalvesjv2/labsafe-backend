import { describe, test, expect, jest } from "@jest/globals";
import { createUserService } from "../services/userService";
import { createUserRepository, listUserByEmailRepository, updateUserRepository } from "../repositories/userRepository";

jest.mock("../repositories/userRepository", () => ({
    createUserRepository: jest.fn(),
    listUsersRepository: jest.fn(),
    listUserByEmailRepository: jest.fn(),
    listUserByIdRepository: jest.fn(),
    updateUserRepository: jest.fn(),
    deleteUserRepository: jest.fn(),
}))