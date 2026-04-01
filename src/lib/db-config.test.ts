import { promises as fs } from "fs";
import { resolveDatabaseConnection } from "@/lib/db-config";

vi.mock("@aws-sdk/client-secrets-manager", () => {
  class GetSecretValueCommand {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  }

  class SecretsManagerClient {
    send = vi.fn(async () => ({
      SecretString: JSON.stringify({
        DATABASE_URL:
          "postgres://secret-user:secret-pass@example.com:5432/pangintakedb",
      }),
    }));
  }

  return {
    GetSecretValueCommand,
    SecretsManagerClient,
  };
});

describe("db-config", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a direct database url", async () => {
    vi.spyOn(fs, "readFile").mockResolvedValue(
      "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
    );

    const result = await resolveDatabaseConnection({
      awsRegion: "us-west-1",
      databaseUrl:
        "postgres://user:pass@localhost:5432/postgres?sslmode=verify-full&sslrootcert=certs/rds/global-bundle.pem",
      databaseSslMode: "require",
      subnetIds: [],
      securityGroupIds: [],
    });

    expect(result.source).toBe("url");
    expect(result.config.host).toBe("localhost");
    expect(result.config.database).toBe("postgres");
    expect(result.config.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it("accepts DATABASE_URL inside a Secrets Manager JSON payload", async () => {
    vi.spyOn(fs, "readFile").mockResolvedValue(
      "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
    );

    const result = await resolveDatabaseConnection({
      awsRegion: "us-west-1",
      databaseSecretArn: "arn:aws:secretsmanager:us-west-1:123456789012:secret:test",
      databaseSslMode: "verify-full",
      subnetIds: [],
      securityGroupIds: [],
    });

    expect(result.source).toBe("secret");
    expect(result.config.host).toBe("example.com");
    expect(result.config.database).toBe("pangintakedb");
  });

  it("throws a staged SSL error when verification is enabled without a CA bundle", async () => {
    vi.spyOn(fs, "readFile").mockRejectedValue(new Error("missing"));

    await expect(
      resolveDatabaseConnection({
        awsRegion: "us-west-1",
        databaseUrl: "postgres://user:pass@localhost:5432/postgres",
        databaseSslMode: "verify-full",
        subnetIds: [],
        securityGroupIds: [],
      }),
    ).rejects.toMatchObject({
      stage: "ssl",
    });
  });
});
