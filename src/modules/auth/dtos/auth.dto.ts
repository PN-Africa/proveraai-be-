import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// DTOs describe request bodies: validation (class-validator) + docs (ApiProperty)
export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Account email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'securepassword123',
    description: 'Account password',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
