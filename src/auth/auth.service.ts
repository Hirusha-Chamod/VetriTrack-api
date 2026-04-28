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

/**
 * Identity and Access Management (IAM) Engine.
 * Handles user lifecycle, cryptographic password validation, JWT issuance, 
 * and secure account recovery workflows.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  // ============================================================================
  // CORE AUTHENTICATION (SIGNUP & LOGIN)
  // ============================================================================

  async signUp(signUpDto: SignUpDto): Promise<{ message: string }> {
    const { fullName, username, email, password, role, avatarUrl } = signUpDto;

    /*
     * Step 1: Uniqueness Verification
     * Ensure neither the username nor email is already claimed in the system.
     */
    const userExists = await this.userModel.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (userExists) {
      throw new ConflictException('Username or Email already taken');
    }

    /*
     * Step 2: Cryptographic Security
     * Salt and hash the password using bcrypt (Cost factor: 10) before touching the database.
     */
    const hashedPassword = await bcrypt.hash(password, 10);

    /*
     * Step 3: Account Provisioning
     * Create the user record and explicitly set the account status to 'active'.
     */
    await this.userModel.create({
      fullName,
      username,
      email, 
      password: hashedPassword,
      role,
      avatarUrl, 
      status: 'active', 
    });

    return { message: 'User registered successfully' };
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: { id: string; username: string; role: string; avatarUrl?: string } }> {
    const { username, password } = loginDto;

    /*
     * Step 1: Account Validation
     * Fetch the user and explicitly request the hidden password field for comparison.
     * Also checks if the account has been soft-deleted or suspended ('inactive').
     */
    const user = await this.userModel.findOne({ username }).select('+password');
    
    if (!user || user.status === 'inactive') {
      throw new UnauthorizedException('Invalid credentials or account disabled');
    }

    /*
     * Step 2: Cryptographic Verification
     */
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException('Invalid password');
    }

    /*
     * Step 3: Audit Trail Update
     * Stamp the last login time for security monitoring and inactive-account pruning.
     */
    user.lastLogin = new Date();
    await user.save();

    /*
     * Step 4: Token Issuance
     * Generate a stateless JWT containing the user's identity and RBAC role.
     */
    const token = this.jwtService.sign({ id: user._id, role: user.role });

    return { 
      accessToken: token, 
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl 
      } 
    }
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  async getAllUsers(): Promise<User[]> {
    // Strip out password hashes from the payload to prevent accidental leakage
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
    const { fullName, email, role, password, avatarUrl } = updateUserDto;

    const user = await this.userModel.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Step 1: Email Collision Prevention
    // If updating the email, ensure the new email isn't owned by another user.
    if (email) {
      const existingUser = await this.userModel.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
      user.email = email;
    }

    if (fullName) user.fullName = fullName;
    if (role) user.role = role;
    if (avatarUrl) user.avatarUrl = avatarUrl;

    // Step 2: Conditional Cryptography
    // Only re-hash if the user explicitly provided a new password in the payload.
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    const updatedUser = await this.userModel.findById(id).select('-password').exec();
    return updatedUser!;
  }

  async deactivateUser(id: string): Promise<{ message: string }> {
    /*
     * Security Strategy: Soft Deletion
     * We mark the user as 'inactive' rather than deleting the DB row. 
     * This preserves historical referential integrity (e.g., knowing who approved an old PO).
     */
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = 'inactive';
    await user.save();

    return { message: 'User deactivated successfully' };
  }

  // ============================================================================
  // PASSWORD RECOVERY WORKFLOW (OTP)
  // ============================================================================

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email });
    
    /*
     * Step 1: Anti-Enumeration Defense
     * Always return the exact same success message whether the email exists or not. 
     * This prevents malicious actors from probing the API to guess registered emails.
     */
    if (!user) {
      return { message: 'If that email exists, an OTP has been sent.' };
    }

    /*
     * Step 2: Generate Time-Bound OTP
     * Create a 6-digit code strictly valid for a 15-minute sliding window.
     */
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = expires;
    await user.save();

    /*
     * Step 3: Out-of-band Communication
     * Dispatch the email asynchronously so the HTTP request doesn't hang.
     */
    this.mailerService.sendMail({
      to: user.email,
      subject: 'VetriTrack - Password Reset Verification Code',
      text: `Hello ${user.fullName},\n\nWe received a request to reset your VetriTrack password.\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you did not request a password reset, please ignore this email or contact your administrator.\n\nThank you,\nVetriTrack Security`,
    }).catch(err => console.error('Failed to send OTP email in background:', err));

    return { message: 'If that email exists, an OTP has been sent.' };
  }

  async verifyOtp(email: string, otp: string): Promise<{ isValid: boolean; message: string }> {
    /*
     * Step 1: Validates that the OTP matches AND the expiration window hasn't elapsed.
     */
    const user = await this.userModel.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    return { isValid: true, message: 'OTP verified successfully' };
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
    /*
     * Step 1: Re-verify OTP integrity right before the final password change.
     */
    const user = await this.userModel.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    /*
     * Step 2: Apply Cryptography & Cleanup
     * Hash the new password, then immediately destroy the OTP payload so it cannot be reused.
     */
    user.password = await bcrypt.hash(newPassword, 10);
    
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    return { message: 'Password has been successfully reset' };
  }
}