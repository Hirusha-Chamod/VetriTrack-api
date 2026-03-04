import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt'; 
import { User } from './schemas/user.schema';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  // SIGN UP LOGIC
  async signUp(signUpDto: SignUpDto): Promise<{ message: string }> {
    const { fullName, username, password, role } = signUpDto;

    // Check if user already exists
    const userExists = await this.userModel.findOne({ username });
    if (userExists) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await this.userModel.create({
      fullName,
      username,
      password: hashedPassword,
      role,
    });

    return { message: 'User registered successfully' };
  }

  // LOGIN LOGIC
  async login(loginDto: LoginDto): Promise<{ accessToken: string; role: string }> {
    const { username, password } = loginDto;

    const user = await this.userModel.findOne({ username });
    if (!user) {
      throw new UnauthorizedException('Invalid username');
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException('Invalid password');
    }

    // Generate JWT Token
    const token = this.jwtService.sign({ id: user._id, role: user.role });

    return { accessToken: token, role: user.role };
  }
}