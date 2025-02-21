// import { Inject, Injectable, Logger } from '@nestjs/common';
// import { BaseChannel } from './channel.abstract';
// import { ChannelTypeEnum } from 'src/common/enums';
// import { CHANNEL_TYPE_TO_CLASS_MAP } from './channel.config';

// // @Injectable()
// // export class ChannelFactory {
// //   constructor(
// //     private readonly logger: Logger,
// //     private readonly channelType: ChannelTypeEnum,
// //   ) {}

// //   createChannel(channelType: ChannelTypeEnum): BaseChannel {
// //     this.logger.log(
// //       'In ChannelFactory createChannel method, channelType',
// //       channelType,
// //     );

// //     return new CHANNEL_TYPE_TO_CLASS_MAP[channelType]();
// //   }
// // }

// @Injectable()
// export class ChannelFactory {
//   constructor(
//     private readonly logger: Logger,
//     @Inject('CHANNEL_INSTANCES')
//     private readonly channelInstances: Map<ChannelTypeEnum, BaseChannel>,
//   ) {}

//   createChannel(channelType: ChannelTypeEnum): BaseChannel {
//     this.logger.log(
//       'In ChannelFactory createChannel method, channelType',
//       channelType,
//     );
//     const channel = this.channelInstances.get(channelType);
//     if (!channel) {
//       throw new Error(`Unsupported channel type: ${channelType}`);
//     }
//     return channel;
//   }
// }
