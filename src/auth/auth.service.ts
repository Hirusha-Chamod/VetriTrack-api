import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt'; 
import { User } from './schemas/user.schema';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: { id: string; username: string; role: string } }> {
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

    return { 
    accessToken: token, 
    user: {
      id: user._id.toString(),
      username: user.username,
      role: user.role 
    } }
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.userModel.find().select('-password');
    return users;
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password');
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const { fullName, email, role, password } = updateUserDto;

    const user = await this.userModel.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await this.userModel.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
      user.email = email;
    }

    if (fullName) {
      user.fullName = fullName;
    }

    if (role) {
      user.role = role;
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    const updatedUser = await this.userModel.findById(id).select('-password').exec();
    return updatedUser!;
  }

  async deactivateUser(id: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = 'inactive';
    await user.save();

    return { message: 'User deactivated successfully' };
  }
}