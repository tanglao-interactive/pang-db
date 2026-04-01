import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import type { Knex } from "knex";
import { readExplorerEnv, type ExplorerEnv } from "@/lib/env";
import { ExplorerError, normalizeExplorerError } from "@/lib/explorer-error";

interface SecretPayload {
  DATABASE_URL?: string;
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
  try {
    if (env.databaseUrl) {
      return {
        config: buildPgConnectionConfigFromUrl(env.databaseUrl, env),
        source: "url",
      };
    }

    if (!env.databaseSecretArn) {
      throw new ExplorerError("DATABASE_URL or DATABASE_SECRET_ARN is required.", {
        stage: "env",
      });
    }

    const secretValue = await getSecretPayload(env);
    const connectionUrl =
      secretValue.DATABASE_URL ??
      secretValue.url ??
      secretValue.uri ??
      secretValue.connectionString;

    if (connectionUrl) {
      return {
        config: buildPgConnectionConfigFromUrl(connectionUrl, env),
        source: "secret",
      };
    }

    if (
      !secretValue.host ||
      !secretValue.username ||
      !secretValue.password ||
      !(secretValue.dbname ?? secretValue.database)
    ) {
      throw new ExplorerError(
        "Secret payload must include a URL or host/username/password/database fields.",
        {
          stage: "secret",
          details: `Secret keys: ${Object.keys(secretValue).join(", ")}`,
        },
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
        connectionTimeoutMillis: 5_000,
        query_timeout: 10_000,
        statement_timeout: 10_000,
      },
      source: "secret",
    };
  } catch (error) {
    throw normalizeExplorerError(error, "secret");
  }
}

async function getSecretPayload(env: ExplorerEnv): Promise<SecretPayload> {
  try {
    const client = new SecretsManagerClient({
      region: env.awsRegion,
      maxAttempts: 1,
    });
    const command = new GetSecretValueCommand({
      SecretId: env.databaseSecretArn,
    });
    const response = await client.send(command);
    const secretString = response.SecretString;

    if (!secretString) {
      throw new ExplorerError("Secret ARN resolved, but no SecretString was returned.", {
        stage: "secret",
      });
    }

    try {
      return JSON.parse(secretString) as SecretPayload;
    } catch {
      return { url: secretString };
    }
  } catch (error) {
    throw normalizeExplorerError(error, "secret");
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
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
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
