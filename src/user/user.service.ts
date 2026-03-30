import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create.user.dto';
import { Profile, User } from '@generated/prisma/client';
import { CreateProfileDto } from './dto/create.profile.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    return await this.prisma.user.create({ data: dto });
  }

  async getUsers(): Promise<User[]> {
    return await this.prisma.user.findMany();
  }

  async getUser(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User Not Found');
    }
    return user;
  }

  async createProfile(id: string, dto: CreateProfileDto): Promise<Profile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingProfile = await this.prisma.profile.findFirst({
      where: { userId: id },
    });

    if (existingProfile) {
      throw new BadRequestException('Profile already exists for this user');
    }

    return this.prisma.profile.create({
      data: {
        ...dto,
        user: {
          connect: { id },
        },
      },
    });
  }

  async deleteUser(id: string) {
    try {
      await this.prisma.user.delete({ where: { id } });
      return 'User deleted successfully';
    } catch (error) {
      throw new NotFoundException(
        error instanceof Error ? error.message : 'User not found',
      );
    }
  }
}
