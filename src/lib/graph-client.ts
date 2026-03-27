import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import {
  TokenCredentialAuthenticationProvider,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

let _client: Client | null = null;

/**
 * Microsoft Graph API が利用可能かどうか
 */
export function isGraphAvailable(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET
  );
}

/**
 * Graph Client を取得 (シングルトン)
 * Azure AD の App-Only (Client Credentials) フローで認証
 */
export function getGraphClient(): Client {
  if (_client) return _client;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET が .env.local に設定されていません"
    );
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  _client = Client.initWithMiddleware({ authProvider });
  return _client;
}
