import { BaseChannel } from './channel.abstract';
import { CHANNEL_PROVIDER_CONST } from './channel.constant';
import { FynoChannel } from './implementations/fyno/fyno';
import { ChannelTypeEnum } from 'src/common/enums';

export const channelProviders = [
  {
    provide: CHANNEL_PROVIDER_CONST.CHANNEL_INSTANCES,
    useFactory: (fynoChannel: FynoChannel) => {
      const map = new Map<ChannelTypeEnum, BaseChannel>();
      map.set(ChannelTypeEnum.FYNO, fynoChannel);
      return map;
    },
    inject: [FynoChannel],
  },
];
