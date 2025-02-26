// import { ModuleRef } from '@nestjs/core';
import { Injectable } from "@nestjs/common";
import { NP_TYPE_TO_CLASS_MAP } from "src/services/network-partners/np-to-class-map.config";
import { DELIVERY_PARTNER_ENUM } from "src/common/enums/global.enum";

@Injectable()
export class NPFactory {
    constructor() { }

    createNP(npType: DELIVERY_PARTNER_ENUM): any {
        console.log("NP factory");
        return new NP_TYPE_TO_CLASS_MAP[npType]()
    }
}
