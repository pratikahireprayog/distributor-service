import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
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
        {
            provide: 'Logger',
            useFactory: () => {
                return console;
            },
        },
    ],
    exports: [BigshipService, BigshipAuthService]
})
export class BigshipModule { } 