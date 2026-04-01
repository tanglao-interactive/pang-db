import { promises as fs } from "fs";
import path from "path";
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
      const ssl = await resolveSslConfig(env, env.databaseUrl);
      return {
        config: buildPgConnectionConfigFromUrl(env.databaseUrl, ssl),
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
      const ssl = await resolveSslConfig(env, connectionUrl);
      return {
        config: buildPgConnectionConfigFromUrl(connectionUrl, ssl),
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

    const ssl = await resolveSslConfig(env);

    return {
      config: {
        host: secretValue.host,
        port: Number(secretValue.port ?? 5432),
        user: secretValue.username,
        password: secretValue.password,
        database: secretValue.dbname ?? secretValue.database,
        ssl,
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
  ssl: Knex.PgConnectionConfig["ssl"],
): Knex.PgConnectionConfig {
  const url = new URL(connectionUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  };
}

async function resolveSslConfig(
  env: ExplorerEnv,
  connectionUrl?: string,
): Promise<false | { rejectUnauthorized: boolean; ca?: string; servername?: string }> {
  const sslMode = resolveEffectiveSslMode(env, connectionUrl);
  if (sslMode === "disable") {
    return false;
  }

  if (sslMode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  const ca = await resolveCaPem(env, connectionUrl);
  if (!ca) {
    throw new ExplorerError(
      "SSL verification requires an RDS CA bundle. Set DATABASE_SSL_CA_FILE, DATABASE_SSL_CA_PEM, or use a connection URL with sslrootcert.",
      {
        stage: "ssl",
      },
    );
  }

  const servername = connectionUrl ? new URL(connectionUrl).hostname : undefined;
  return { rejectUnauthorized: true, ca, servername };
}

function resolveEffectiveSslMode(
  env: ExplorerEnv,
  connectionUrl?: string,
): ExplorerEnv["databaseSslMode"] {
  if (env.databaseSslMode && env.databaseSslMode !== "require") {
    return env.databaseSslMode;
  }

  const urlMode = connectionUrl
    ? new URL(connectionUrl).searchParams.get("sslmode")
    : undefined;
  if (urlMode === "disable" || urlMode === "no-verify" || urlMode === "verify-full") {
    return urlMode;
  }
  if (urlMode === "require") {
    return "require";
  }

  return env.databaseSslMode;
}

async function resolveCaPem(
  env: ExplorerEnv,
  connectionUrl?: string,
): Promise<string | undefined> {
  if (env.databaseSslCaPem) {
    return normalizePem(env.databaseSslCaPem);
  }

  const candidateFiles = [
    readSslRootCertFromUrl(connectionUrl),
    env.databaseSslCaFile,
    "certs/rds/global-bundle.pem",
    "global-bundle.pem",
  ].filter(Boolean) as string[];

  for (const file of candidateFiles) {
    const pem = await tryReadPem(file);
    if (pem) {
      return pem;
    }
  }

  return undefined;
}

function readSslRootCertFromUrl(connectionUrl?: string): string | undefined {
  if (!connectionUrl) {
    return undefined;
  }

  return new URL(connectionUrl).searchParams.get("sslrootcert") ?? undefined;
}

async function tryReadPem(file: string): Promise<string | undefined> {
  const candidates = path.isAbsolute(file)
    ? [file]
    : [path.resolve(process.cwd(), file), path.resolve("/var/task", file)];

  for (const candidate of candidates) {
    try {
      const pem = await fs.readFile(candidate, "utf8");
      return normalizePem(pem);
    } catch {
      continue;
    }
  }

  return undefined;
}

function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, "\n");
}
