import { PARTNER_CODE_ENUM } from "src/common/enums/global.enum";
import { BigshipService } from "./implementation/bigship/bigship.service";
import { SmileHyperlocalService } from "./implementation/smile-hyperlocal/smile-hyperlocal.service";

export const NP_TYPE_TO_CLASS_MAP = {
    [PARTNER_CODE_ENUM.BIGSHIP]: BigshipService,
    [PARTNER_CODE_ENUM.SMILE_HYPERLOCAL]: SmileHyperlocalService,
} as const;
