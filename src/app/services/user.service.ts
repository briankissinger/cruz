import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { IUserRepository } from '../../core/interfaces/repository/index.js';
import { UserEntity, UserStatusEnum } from '../../core/domain/user.entity.js';
import type { UUID } from '../../core/domain/base.entity.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { ApplicationError } from './authentication.service.js';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
}

@injectable()
export class UserService {
  constructor(
    @inject(TYPES.UserRepository) private userRepository: IUserRepository,
  ) {}

  async createUser(input: CreateUserInput): Promise<UserEntity> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ApplicationError('Email already registered', ERROR_CODES.CONFLICT, HTTP_STATUS.CONFLICT);
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = UserEntity.create({
      name: input.name,
      email: input.email,
      passwordHash,
      status: UserStatusEnum.ACTIVE,
    });

    return this.userRepository.create(user);
  }

  async findById(id: UUID): Promise<UserEntity | null> {
    return this.userRepository.findById(id);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email);
  }

  async verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return computedHash === passwordHash;
  }

  async updateUser(id: UUID, input: UpdateUserInput): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new ApplicationError('User not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (input.name) user.updateName(input.name);
    if (input.email) {
      const existing = await this.userRepository.findByEmail(input.email);
      if (existing && existing.id !== id) {
        throw new ApplicationError('Email already in use', ERROR_CODES.CONFLICT, HTTP_STATUS.CONFLICT);
      }
      user.updateEmail(input.email);
    }

    return this.userRepository.update(user);
  }

  async deactivateUser(id: UUID): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new ApplicationError('User not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    user.deactivate();
    return this.userRepository.update(user);
  }

  async activateUser(id: UUID): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new ApplicationError('User not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    user.activate();
    return this.userRepository.update(user);
  }

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const combined = new Uint8Array(salt.length + data.length);
    combined.set(salt);
    combined.set(data, salt.length);

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
  }
}