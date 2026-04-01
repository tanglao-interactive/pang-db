import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import type { Knex } from "knex";
import { readExplorerEnv, type ExplorerEnv } from "@/lib/env";

interface SecretPayload {
  url?: string;
  uri?: string;
  connectionString?: string;
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  dbname?: string;
  database?: string;
}

export async function resolveDatabaseConnection(
  env: ExplorerEnv = readExplorerEnv(),
): Promise<{ config: Knex.PgConnectionConfig; source: "url" | "secret" }> {
  if (env.databaseUrl) {
    return {
      config: buildPgConnectionConfigFromUrl(env.databaseUrl, env),
      source: "url",
    };
  }

  if (!env.databaseSecretArn) {
    throw new Error("DATABASE_URL or DATABASE_SECRET_ARN is required.");
  }

  const secretValue = await getSecretPayload(env);
  const connectionUrl =
    secretValue.url ?? secretValue.uri ?? secretValue.connectionString;

  if (connectionUrl) {
    return {
      config: buildPgConnectionConfigFromUrl(connectionUrl, env),
      source: "secret",
    };
  }

  if (!secretValue.host || !secretValue.username || !secretValue.password) {
    throw new Error(
      "Secret payload must include a URL or host/username/password/database fields.",
    );
  }

  return {
    config: {
      host: secretValue.host,
      port: Number(secretValue.port ?? 5432),
      user: secretValue.username,
      password: secretValue.password,
      database: secretValue.dbname ?? secretValue.database,
      ssl: resolveSslConfig(env.databaseSslMode),
    },
    source: "secret",
  };
}

async function getSecretPayload(env: ExplorerEnv): Promise<SecretPayload> {
  const client = new SecretsManagerClient({ region: env.awsRegion });
  const command = new GetSecretValueCommand({
    SecretId: env.databaseSecretArn,
  });
  const response = await client.send(command);
  const secretString = response.SecretString;

  if (!secretString) {
    throw new Error("Secret ARN resolved, but no SecretString was returned.");
  }

  try {
    return JSON.parse(secretString) as SecretPayload;
  } catch {
    return { url: secretString };
  }
}

function buildPgConnectionConfigFromUrl(
  connectionUrl: string,
  env: ExplorerEnv,
): Knex.PgConnectionConfig {
  const url = new URL(connectionUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: resolveSslConfig(env.databaseSslMode),
  };
}

function resolveSslConfig(
  sslMode: ExplorerEnv["databaseSslMode"],
): false | { rejectUnauthorized: boolean } {
  if (sslMode === "disable") {
    return false;
  }

  if (sslMode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}
