import { DELIVERY_PARTNER_ENUM } from "src/common/enums/global.enum";
import { BigshipService } from "./bigship/bigship.service";

export const NP_TYPE_TO_CLASS_MAP = {
    [DELIVERY_PARTNER_ENUM.BIGSHIP]: BigshipService,
} as const;
