/* eslint-disable prettier/prettier */
import { applyDecorators, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AUTH_TYPE } from './auth.constant';

@Injectable()
export default class RolesGuard extends AuthGuard(['jwt','firebase-auth']) {
    constructor(private reflector: Reflector) {
        super();
    }
    
    public async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const user  = context.switchToHttp().getRequest().body.user;
    if(!user || user.length ===0){
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    }

    const requireRoles = this.reflector.getAllAndOverride<AUTH_TYPE[]>("roles", [
        context.getHandler(),
        context.getClass(),
    ]);
    if (!requireRoles || requireRoles.length === 0) {
    return true;
    }
    const hasRole: boolean = requireRoles.some((role) => user.authType === role);
    if(!hasRole){
        throw new ForbiddenException('User do not have rights to access this route');
    } else {
        return true;
    }
    }

}

export function AuthGuardWithRoles(...roles: string[]) {
    return applyDecorators(
        SetMetadata('roles', roles),
        UseGuards(RolesGuard),
    );
}
