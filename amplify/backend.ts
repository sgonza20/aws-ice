import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import * as iam from "aws-cdk-lib/aws-iam";
import { describeInstances } from "./functions/describe-instances/resource";
import { invokeSSM } from './functions/invoke-ssm/resource';
import { scanStatus } from './functions/scan-status/resource';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as destinations from "aws-cdk-lib/aws-logs-destinations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as url from "url";

const backend = defineBackend({
  auth,
  data,
  describeInstances,
  invokeSSM,
  scanStatus
});

const instanceTableName = backend.data.resources.tables["Instance"].tableName;
const instanceTableArn = backend.data.resources.tables["Instance"].tableArn;

const scanStatusLambaArn = backend.scanStatus.resources.lambda.functionArn;

const customResourceStack = backend.createStack("AwsIceCustomResources");

const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

const logGroup = new logs.LogGroup(
  customResourceStack,
  "AwsInstanceTrailLogGroup",
  {
    retention: logs.RetentionDays.ONE_WEEK,
  }
);

const scanStatusFunction = new NodejsFunction(
  customResourceStack,
  "AwsScanStatusFunction",
  {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: url.fileURLToPath(
      new URL("./functions/scan-status/handler.ts", import.meta.url)
    ),
    environment: {
      INSTANCE_TABLE_NAME: instanceTableName,
    },
    logRetention: logs.RetentionDays.ONE_MONTH,
  }
);


const readWriteToInstanceTableStatement = new iam.PolicyStatement({
  sid: "DynamoDBAccess",
  effect: iam.Effect.ALLOW,
  actions: [
    "dynamodb:BatchGetItem",
    "dynamodb:BatchWriteItem",
    "dynamodb:PutItem",
    "dynamodb:DeleteItem",
    "dynamodb:GetItem",
    "dynamodb:Scan",
    "dynamodb:Query",
    "dynamodb:UpdateItem",
    "dynamodb:ConditionCheckItem",
    "dynamodb:DescribeTable",
    "dynamodb:GetRecords",
    "dynamodb:GetShardIterator",
  ],
  resources: [instanceTableArn, instanceTableArn + "/*"],
});
scanStatusFunction.addToRolePolicy(readWriteToInstanceTableStatement);

new logs.SubscriptionFilter(
  customResourceStack,
  "AwsIceTrailSubscriptionFilter",
  {
    logGroup: logGroup,
    filterPattern: logs.FilterPattern.stringValue(
      "$.userIdentity.userName",
      "=",
      "devops-admin-*"
    ),
    destination: new destinations.LambdaDestination(scanStatusFunction),
  }
);

const ssmPolicy = new iam.PolicyStatement({
  sid: "SSM",
  effect: iam.Effect.ALLOW,
  actions: ["ssm:DescribeInstanceInformation"],
  resources: ["*"],
});

const fetchInstances = backend.describeInstances.resources.lambda;
fetchInstances.addToRolePolicy(ssmPolicy);

const InvokesSSMPolicy = new iam.PolicyStatement({
  sid: "SSM",
  effect: iam.Effect.ALLOW,
  actions: ["ssm:SendCommand"],
  resources: ["*"],
});

const runSSM = backend.invokeSSM.resources.lambda;
runSSM.addToRolePolicy(InvokesSSMPolicy);

// Define the CloudWatch Rule to listen for SSM Command state changes
const ssmStateChangeRule = new events.Rule(
  customResourceStack,
  "SSMCommandStateChangeRule",
  {
    eventPattern: {
      source: ["aws.ssm"],
      detailType: ["EC2 Command Status-change Notification"],
    },
    targets: [
      new targets.LambdaFunction(scanStatusFunction, {
        event: events.RuleTargetInput.fromObject({}),
      }),
    ],
  }
);