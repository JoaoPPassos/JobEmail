import { Body, Controller, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { MongoUserInboxRepository } from '../../../infrastructure/inbox/mongo/repositories/mongo-user-inbox.repository.js';
import { UpdatePasswordDTO } from '../dto/update-password.dto.js';

@Controller('users')
export class UserInboxController {
  constructor(private readonly userInboxRepository: MongoUserInboxRepository) {}

  @Patch(':userId/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePassword(
    @Param('userId') userId: string,
    @Body() dto: UpdatePasswordDTO,
  ): Promise<void> {
    await this.userInboxRepository.updatePassword(userId, dto.encryptedPassword);
  }
}
