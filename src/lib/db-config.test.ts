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
  it("parses a direct database url", async () => {
    const result = await resolveDatabaseConnection({
      awsRegion: "us-west-1",
      databaseUrl: "postgres://user:pass@localhost:5432/postgres",
      databaseSslMode: "disable",
      subnetIds: [],
      securityGroupIds: [],
    });

    expect(result.source).toBe("url");
    expect(result.config.host).toBe("localhost");
    expect(result.config.database).toBe("postgres");
  });

  it("accepts DATABASE_URL inside a Secrets Manager JSON payload", async () => {
    const result = await resolveDatabaseConnection({
      awsRegion: "us-west-1",
      databaseSecretArn: "arn:aws:secretsmanager:us-west-1:123456789012:secret:test",
      databaseSslMode: "require",
      subnetIds: [],
      securityGroupIds: [],
    });

    expect(result.source).toBe("secret");
    expect(result.config.host).toBe("example.com");
    expect(result.config.database).toBe("pangintakedb");
  });
});
