import { Injectable } from '@nestjs/common';
import { FYNO_ENV_CONST } from './fyno.constant';
import { GlobalConst } from 'src/common';
import {
  NotificationSecretsRepository,
  NotificationSecretsModel,
} from 'src/common/repositories';
// import { QueryFilter } from 'src/infrastructure/database/query-filter/query-filter';

@Injectable()
export class FynoConfig {
  private _clientId: string;
  private _defaultClientId: string;
  private _fynoStartBaseURL: string;
  private _fynoEndBaseURL: string;
  private _fynoVersion1: string;
  private _fynoApiKey: string;
  private _fynoEventAPI: string;
  private _fynoWorkspaceId: string;
  private _fynoCallbackURLName: string;

  static async create(
    clientId: string,
    notificationSecretsRepo: NotificationSecretsRepository,
  ): Promise<FynoConfig> {
    const instance = new FynoConfig();
    await instance.initialize(clientId);
    await instance.setFynoSecrets(notificationSecretsRepo);
    instance.setFynoEventAPI();
    return instance;
  }

  async initialize(clientId: string): Promise<void> {
    this._clientId = clientId;
    this._defaultClientId =
      process.env[GlobalConst.ENV_CONST.DEFAULT_VENDOR_CODE];
    this._fynoStartBaseURL = process.env[FYNO_ENV_CONST.FYNO_START_BASE_URL];
    this._fynoEndBaseURL = process.env[FYNO_ENV_CONST.FYNO_END_BASE_URL];
    this._fynoVersion1 = process.env[FYNO_ENV_CONST.FYNO_VERSION_1];
    this._fynoCallbackURLName =
      process.env[FYNO_ENV_CONST.FYNO_CALLBACK_URL_NAME];

    if (
      !this._fynoStartBaseURL ||
      !this._fynoEndBaseURL ||
      !this._fynoVersion1 ||
      !this._fynoCallbackURLName
    ) {
      throw new Error(
        'Missing Fyno configuration. Please check your environment variables.',
      );
    }
  }

  private async setFynoSecrets(
    notificationSecretsRepo: NotificationSecretsRepository,
  ) {
    const notificationSecrets: NotificationSecretsModel[] =
      await notificationSecretsRepo.getAll({
        $or: [
          { clientId: this._clientId },
          { clientId: this._defaultClientId },
        ],
      });
    const clientSecrets = notificationSecrets.find(
      (secret) => secret.clientId === this._clientId,
    );
    const defaultSecrets = notificationSecrets.find(
      (secret) => secret.clientId === this._defaultClientId,
    );
    this._fynoApiKey = clientSecrets?.fynoApiKey || defaultSecrets.fynoApiKey;
    this._fynoWorkspaceId = clientSecrets?.wsid || defaultSecrets.wsid;
  }

  // private async buildNotificationSecretsQuery() {
  //   const query = new QueryFilter()
  //     .orWhere('clientId', '=', this._clientId)
  //     .orWhere('clientId', '=', 'http')
  //     .getQuery();

  //   console.log(query);
  //   return query;
  // }

  private setFynoEventAPI() {
    this._fynoEventAPI = `${this._fynoStartBaseURL}/${this._fynoVersion1}/${this._fynoWorkspaceId}/${this._fynoEndBaseURL}`;
  }

  get fynoApiKey(): string {
    return this._fynoApiKey;
  }
  get fynoEventAPI(): string {
    return this._fynoEventAPI;
  }
  get fynoWorkspaceId(): string {
    return this._fynoWorkspaceId;
  }
  get fynoCallbackURLName(): string {
    return this._fynoCallbackURLName;
  }
}
