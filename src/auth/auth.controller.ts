import { Body, Controller, Get, Post, Param, Put, Patch, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/signup.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  
  @Post('/signup')
  signUp(@Body() signUpDto: SignUpDto): Promise<{ message: string }> {
    return this.authService.signUp(signUpDto);
  }

  
  @Post('/login')
  login(@Body() loginDto: LoginDto): Promise<{ accessToken: string; user: { id: string; username: string; role: string } }> {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/users')
  getAllUsers() {
    return this.authService.getAllUsers();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/users/:id')
  getUserById(@Param('id') id: string) {
    return this.authService.getUserById(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('/users/:id')
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.authService.updateUser(id, updateUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('/users/:id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.authService.deactivateUser(id);
  }

  @Post('/forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('/verify-otp')
  verifyOtp(@Body('email') email: string, @Body('otp') otp: string) {
    return this.authService.verifyOtp(email, otp);
  }

  @Post('/reset-password')
  resetPassword(
    @Body('email') email: string, 
    @Body('otp') otp: string, 
    @Body('newPassword') newPassword: string
  ) {
    return this.authService.resetPassword(email, otp, newPassword);
  }
}