import { z } from "zod";
import { ExplorerError } from "@/lib/explorer-error";

const envSchema = z
  .object({
    AWS_REGION: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    DATABASE_SECRET_ARN: z.string().optional(),
    DATABASE_SSL_MODE: z
      .enum(["disable", "require", "no-verify", "verify-full"])
      .optional()
      .default("require"),
    DATABASE_SSL_CA_FILE: z.string().optional(),
    DATABASE_SSL_CA_PEM: z.string().optional(),
    AMPLIFY_DB_EXPLORER_FUNCTION_NAME: z.string().optional(),
    AMPLIFY_VPC_ID: z.string().optional(),
    AMPLIFY_SUBNET_IDS: z.string().optional(),
    AMPLIFY_SECURITY_GROUP_IDS: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.DATABASE_URL && !value.DATABASE_SECRET_ARN) {
      ctx.addIssue({
        code: "custom",
        message: "Either DATABASE_URL or DATABASE_SECRET_ARN must be provided.",
        path: ["DATABASE_URL"],
      });
    }
  });

export interface ExplorerEnv {
  awsRegion?: string;
  databaseUrl?: string;
  databaseSecretArn?: string;
  databaseSslMode: "disable" | "require" | "no-verify" | "verify-full";
  databaseSslCaFile?: string;
  databaseSslCaPem?: string;
  amplifyDbExplorerFunctionName?: string;
  vpcId?: string;
  subnetIds: string[];
  securityGroupIds: string[];
}

export function readExplorerEnv(
  source: Record<string, string | undefined> = process.env,
): ExplorerEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ExplorerError(parsed.error.issues[0]?.message ?? "Invalid environment.", {
      stage: "env",
      details: JSON.stringify(parsed.error.issues),
      statusCode: 500,
    });
  }
  const value = parsed.data;
  return {
    awsRegion: value.AWS_REGION,
    databaseUrl: value.DATABASE_URL,
    databaseSecretArn: value.DATABASE_SECRET_ARN,
    databaseSslMode: value.DATABASE_SSL_MODE ?? "require",
    databaseSslCaFile: value.DATABASE_SSL_CA_FILE,
    databaseSslCaPem: value.DATABASE_SSL_CA_PEM,
    amplifyDbExplorerFunctionName: value.AMPLIFY_DB_EXPLORER_FUNCTION_NAME,
    vpcId: value.AMPLIFY_VPC_ID,
    subnetIds: splitCsv(value.AMPLIFY_SUBNET_IDS),
    securityGroupIds: splitCsv(value.AMPLIFY_SECURITY_GROUP_IDS),
  };
}

export function tryReadExplorerEnv(
  source: Record<string, string | undefined> = process.env,
): { ok: true; value: ExplorerEnv } | { ok: false; error: string } {
  try {
    return { ok: true, value: readExplorerEnv(source) };
  } catch (error) {
    if (error instanceof ExplorerError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Invalid environment." };
  }
}

function splitCsv(value?: string): string[] {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}
