import { Module, Logger } from '@nestjs/common';
import { TemporalWorker } from './temporal.worker';
import { BigshipModule } from 'src/services/network-partners/bigship/bigship.module';
import { BigshipActivity } from 'src/services/activities/bigship-activity/bigship.activity';

@Module({
    imports: [BigshipModule],
    providers: [TemporalWorker, BigshipActivity, Logger],
    exports: [TemporalWorker],
})
export class TemporalModule { } 