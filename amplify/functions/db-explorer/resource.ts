import path from "path";
import { defineFunction } from "@aws-amplify/backend";
import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

function splitCsv(value?: string): string[] {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

export const dbExplorer = defineFunction((scope: Construct) => {
  const vpcId = process.env.AMPLIFY_VPC_ID;
  const subnetIds = splitCsv(process.env.AMPLIFY_SUBNET_IDS);
  const securityGroupIds = splitCsv(process.env.AMPLIFY_SECURITY_GROUP_IDS);

  const vpc = vpcId ? ec2.Vpc.fromLookup(scope, "ExplorerVpc", { vpcId }) : undefined;
  const subnets =
    vpc && subnetIds.length > 0
      ? subnetIds.map((subnetId, index) =>
          ec2.Subnet.fromSubnetId(scope, `ExplorerSubnet${index}`, subnetId),
        )
      : undefined;
  const securityGroups =
    securityGroupIds.length > 0
      ? securityGroupIds.map((securityGroupId, index) =>
          ec2.SecurityGroup.fromSecurityGroupId(
            scope,
            `ExplorerSecurityGroup${index}`,
            securityGroupId,
          ),
        )
      : undefined;

  return new NodejsFunction(scope, "DbExplorerFunction", {
    runtime: lambda.Runtime.NODEJS_20_X,
    entry: path.join(__dirname, "handler.ts"),
    handler: "handler",
    timeout: Duration.seconds(30),
    memorySize: 1024,
    environment: {
      AWS_REGION: process.env.AWS_REGION ?? "",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      DATABASE_SECRET_ARN: process.env.DATABASE_SECRET_ARN ?? "",
      DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE ?? "require",
      AMPLIFY_VPC_ID: process.env.AMPLIFY_VPC_ID ?? "",
      AMPLIFY_SUBNET_IDS: process.env.AMPLIFY_SUBNET_IDS ?? "",
      AMPLIFY_SECURITY_GROUP_IDS: process.env.AMPLIFY_SECURITY_GROUP_IDS ?? "",
    },
    vpc,
    vpcSubnets: subnets ? { subnets } : undefined,
    securityGroups,
    bundling: {
      externalModules: ["aws-sdk"],
    },
  });
});
