import { Body, Controller, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un compte' })
  async register(@Body() dto: RegisterDto) {
    return { success: true, data: await this.authService.register(dto) };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter' })
  async login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    return { success: true, data: await this.authService.login(dto, { userAgent, ipAddress }) };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler les jetons de session' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return { success: true, data: await this.authService.refresh(dto) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Révoquer une session avec son jeton de renouvellement' })
  async logout(@Body() dto: RefreshTokenDto) {
    return { success: true, data: await this.authService.logout(dto) };
  }
}
