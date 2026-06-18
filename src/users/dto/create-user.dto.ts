import { IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  constructor(id: number, name: string, email: string) {
    this.name = name;
    this.email = email;
  }
  @IsString()
  name: string;
  @IsEmail()
  email: string;
}
