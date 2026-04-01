import { readExplorerEnv, tryReadExplorerEnv } from "@/lib/env";

describe("env parsing", () => {
  it("parses database url config", () => {
    const env = readExplorerEnv({
      DATABASE_URL: "postgres://user:pass@localhost:5432/postgres",
      DATABASE_SSL_MODE: "disable",
      AMPLIFY_SUBNET_IDS: "subnet-1, subnet-2",
      AMPLIFY_SECURITY_GROUP_IDS: "sg-1",
    });

    expect(env.databaseUrl).toContain("postgres://");
    expect(env.databaseSslMode).toBe("disable");
    expect(env.subnetIds).toEqual(["subnet-1", "subnet-2"]);
    expect(env.securityGroupIds).toEqual(["sg-1"]);
  });

  it("fails when neither url nor secret arn are present", () => {
    const result = tryReadExplorerEnv({});
    expect(result.ok).toBe(false);
  });
});
