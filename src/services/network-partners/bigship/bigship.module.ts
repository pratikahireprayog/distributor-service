import { Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { BigshipService } from './bigship.service';
import { StatusTrackingLogsRepository } from 'src/common/repositories/status-tracking-logs/status-tracking-logs.repository';
import { StatusTrackingRepository } from 'src/common/repositories/status-tracking/status-tracking.repository';
import { BigshipAuthService } from './bigship-auth.service';
import { StatusTrackingLogsModule } from 'src/common/repositories/status-tracking-logs/status-tracking-logs.module';
import { StatusTrackingModule } from 'src/common/repositories/status-tracking/status-tracking.module';

@Module({
    imports: [
        HttpModule,
        JwtModule.register({
            secret: 'your-secret-key',
        }),
        StatusTrackingLogsModule,
        StatusTrackingModule,
    ],
    providers: [
        BigshipAuthService,
        BigshipService,
        Logger,
    ],
    exports: [BigshipService]
})
export class BigshipModule { } 