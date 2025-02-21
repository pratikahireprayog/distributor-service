// import { Module, Logger } from '@nestjs/common';
// import { ChannelFactory } from './channel.factory';
// import { FynoModule } from './implementations/fyno/fyno.module';
// import { HttpModule } from '@nestjs/axios';
// import { ChannelTypeEnum } from 'src/common/enums';
// import { FynoChannel } from './implementations/fyno/fyno';
// import { BaseChannel } from './channel.abstract';

// @Module({
//   imports: [FynoModule, HttpModule],
//   providers: [
//     ChannelFactory,
//     Logger,
//     {
//       provide: 'CHANNEL_INSTANCES',
//       useFactory: (fynoChannel: FynoChannel) => {
//         const map = new Map<ChannelTypeEnum, BaseChannel>();
//         map.set(ChannelTypeEnum.FYNO, fynoChannel);
//         // Add other channel instances here as needed
//         return map;
//       },
//       inject: [FynoChannel],
//     },
//   ],
//   exports: [ChannelFactory],
// })
// export class ChannelModule {}
