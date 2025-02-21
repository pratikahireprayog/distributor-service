import { ChannelTypeEnum } from 'src/common/enums';
import { FynoChannel } from './implementations/fyno/fyno';

export const CHANNEL_TYPE_TO_CLASS_MAP = {
  [ChannelTypeEnum.FYNO]: FynoChannel,
};
