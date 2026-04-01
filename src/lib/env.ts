import { z } from "zod";

const envSchema = z
  .object({
    AWS_REGION: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    DATABASE_SECRET_ARN: z.string().optional(),
    DATABASE_SSL_MODE: z
      .enum(["disable", "require", "no-verify"])
      .optional()
      .default("require"),
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
  databaseSslMode: "disable" | "require" | "no-verify";
  amplifyDbExplorerFunctionName?: string;
  vpcId?: string;
  subnetIds: string[];
  securityGroupIds: string[];
}

export function readExplorerEnv(
  source: Record<string, string | undefined> = process.env,
): ExplorerEnv {
  const parsed = envSchema.parse(source);
  return {
    awsRegion: parsed.AWS_REGION,
    databaseUrl: parsed.DATABASE_URL,
    databaseSecretArn: parsed.DATABASE_SECRET_ARN,
    databaseSslMode: parsed.DATABASE_SSL_MODE ?? "require",
    amplifyDbExplorerFunctionName: parsed.AMPLIFY_DB_EXPLORER_FUNCTION_NAME,
    vpcId: parsed.AMPLIFY_VPC_ID,
    subnetIds: splitCsv(parsed.AMPLIFY_SUBNET_IDS),
    securityGroupIds: splitCsv(parsed.AMPLIFY_SECURITY_GROUP_IDS),
  };
}

export function tryReadExplorerEnv(
  source: Record<string, string | undefined> = process.env,
): { ok: true; value: ExplorerEnv } | { ok: false; error: string } {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid environment." };
  }

  return { ok: true, value: readExplorerEnv(source) };
}

function splitCsv(value?: string): string[] {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}
