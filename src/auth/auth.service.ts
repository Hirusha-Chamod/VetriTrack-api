import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt'; 
import { User } from './schemas/user.schema';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private mailerService: MailerService,
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

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      // Return success even if user not found to prevent email enumeration attacks
      return { message: 'If that email exists, an OTP has been sent.' };
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration to 15 minutes from now
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = expires;
    await user.save();

    // 👇 Fire off the actual email in the background!
    this.mailerService.sendMail({
      to: user.email,
      subject: 'VetriTrack - Password Reset Verification Code',
      text: `Hello ${user.fullName},\n\nWe received a request to reset your VetriTrack password.\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you did not request a password reset, please ignore this email or contact your administrator.\n\nThank you,\nVetriTrack Security`,
    }).catch(err => console.error('Failed to send OTP email in background:', err));

    return { message: 'If that email exists, an OTP has been sent.' };
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

  async verifyOtp(email: string, otp: string): Promise<{ isValid: boolean; message: string }> {
    const user = await this.userModel.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: new Date() } // Ensure it hasn't expired
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    return { isValid: true, message: 'OTP verified successfully' };
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);
    
    // Clear the OTP fields so they can't be reused
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    return { message: 'Password has been successfully reset' };
  }

}