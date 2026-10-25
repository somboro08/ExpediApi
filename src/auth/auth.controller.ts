import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './guards/jwt-auth.guard';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lire les informations du jeton d’accès courant' })
  me(@CurrentUser() user: AuthenticatedRequest['user']) {
    return { success: true, data: user };
  }
}
