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

  async signUp(signUpDto: SignUpDto): Promise<{ message: string }> {
    const { fullName, username, email, password, role } = signUpDto;

    const userExists = await this.userModel.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (userExists) {
      throw new ConflictException('Username or Email already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.userModel.create({
      fullName,
      username,
      email, 
      password: hashedPassword,
      role,
      status: 'active', // Default status for new users
    });

    return { message: 'User registered successfully' };
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; role: string }> {
    const { username, password } = loginDto;

    const user = await this.userModel.findOne({ username }).select('+password');
    
    if (!user || user.status === 'inactive') {
      throw new UnauthorizedException('Invalid credentials or account disabled');
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException('Invalid password');
    }

    
    user.lastLogin = new Date();
    await user.save();

    const token = this.jwtService.sign({ id: user._id, role: user.role });

    return { accessToken: token, role: user.role };
  }
}