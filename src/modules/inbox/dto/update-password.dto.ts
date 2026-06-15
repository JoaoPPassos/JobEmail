import { IsString, IsNotEmpty } from 'class-validator';

export class UpdatePasswordDTO {
  @IsString()
  @IsNotEmpty()
  encryptedPassword!: string;
}
