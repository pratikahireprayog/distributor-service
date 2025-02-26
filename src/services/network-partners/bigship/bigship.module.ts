import { HttpModule } from '@nestjs/axios';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BigshipAuthService } from './bigship-auth.service';
import { BigshipService } from './bigship.service';

/**
 * Module for Bigship integration
 */
@Module({
    imports: [
        HttpModule,
        ConfigModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'default-secret',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    providers: [
        BigshipService,
        BigshipAuthService,
        Logger,
    ],
    exports: [BigshipService, BigshipAuthService]
})
export class BigshipModule { } 