import { BaseManifestDto, BigshipManifestDto } from './manifest.dto';

export class ResponseDto {
    statusCode: number;
    message: string;
    data?: any;
}

// For backward compatibility
export type CreateManifestDto = BigshipManifestDto; 