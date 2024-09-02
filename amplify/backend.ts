  import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
  import { defineBackend } from '@aws-amplify/backend';
  import { auth } from './auth/resource';
  import { data } from './data/resource';
  import * as iam from "aws-cdk-lib/aws-iam";
  import { describeInstances } from "./functions/describe-instances/resource";
  import { invokeSSM } from './functions/invoke-ssm/resource';
  import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
  import * as lambda from "aws-cdk-lib/aws-lambda";
  import * as events from "aws-cdk-lib/aws-events";
  import * as targets from "aws-cdk-lib/aws-events-targets";
  import * as logs from "aws-cdk-lib/aws-logs";
  import * as url from "url";
  import * as s3 from "aws-cdk-lib/aws-s3";
  import * as s3Notifications from "aws-cdk-lib/aws-s3-notifications";
  import * as ssm from 'aws-cdk-lib/aws-ssm';
  import { Duration } from 'aws-cdk-lib';
  import * as sqs from 'aws-cdk-lib/aws-sqs';
  import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';


  const backend = defineBackend({
    auth,
    data,
    describeInstances,
    invokeSSM
  });
  const customResourceStack = backend.createStack("AwsIceCustomResources");

  const instanceTableName = backend.data.resources.tables["Instance"].tableName;
  const instanceTableArn = backend.data.resources.tables["Instance"].tableArn;


  const findingsQueue = new sqs.Queue(customResourceStack, 'FindingsQueue', {
    visibilityTimeout: Duration.seconds(300),
    retentionPeriod: Duration.days(1), 
  });

  const scapScanResultsBucket = new s3.Bucket(customResourceStack, "SCAPScanResultsBucket", {
    publicReadAccess: false,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  });

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

  const instanceFindingsFunction = new NodejsFunction(
    customResourceStack,
    "AwsinstanceFindingsFunction",
    {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: url.fileURLToPath(
        new URL("./functions/instance-findings/handler.ts", import.meta.url)
      ),
      environment: {
        FINDINGS_TABLE_NAME: backend.data.resources.tables["Finding"].tableName,
        S3_BUCKET_NAME: scapScanResultsBucket.bucketName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      timeout: Duration.minutes(5),
      memorySize: 1024,
    }
  );
  
  instanceFindingsFunction.addEventSource(new lambdaEventSources.SqsEventSource(findingsQueue, {
    batchSize: 10,
  }));

  const sqsPolicy = new iam.PolicyStatement({
    actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
    resources: ["*"],
  });
  
  instanceFindingsFunction.addToRolePolicy(sqsPolicy);

  // IAM policy for DynamoDB access
  const dynamoPolicy = new iam.PolicyStatement({
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
    resources: [
      instanceTableArn,
      instanceTableArn + "/*",
      backend.data.resources.tables["Finding"].tableArn,
      backend.data.resources.tables["Finding"].tableArn + "/*",
    ],
  });
  const cloudwatchPolicy = new iam.PolicyStatement({
    sid: "CloudWatchAccess",
    effect: iam.Effect.ALLOW,
    actions: ["cloudwatch:PutMetricData"],
    resources: ["*"],
  })
  scanStatusFunction.addToRolePolicy(dynamoPolicy);
  instanceFindingsFunction.addToRolePolicy(dynamoPolicy);
  instanceFindingsFunction.addToRolePolicy(cloudwatchPolicy);

  const ssmPolicy = new iam.PolicyStatement({
    sid: "SSM",
    effect: iam.Effect.ALLOW,
    actions: [
      "ssm:DescribeInstanceInformation",
      "ec2:DescribeTags",
      "ec2:DescribeIamInstanceProfileAssociations",
    ],
    resources: ["*"],
  });

  const fetchInstances = backend.describeInstances.resources.lambda;
  fetchInstances.addToRolePolicy(ssmPolicy);

  const InvokesSSMPolicy = new iam.PolicyStatement({
    sid: "SSM",
    effect: iam.Effect.ALLOW,
    actions: [
      "ssm:SendCommand",
      "ssm:GetParameter",
      "ssm:GetParametersByPath",
      "iam:ListPolicies",
      "iam:ListAttachedRolePolicies",
      "iam:AttachRolePolicy",
    ],
    resources: ["*"],
  });

  const runSSM = backend.invokeSSM.resources.lambda;
  runSSM.addToRolePolicy(InvokesSSMPolicy);

  const s3Policy = new iam.PolicyStatement({
    sid: "S3Access",
    effect: iam.Effect.ALLOW,
    actions: [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
    ],
    resources: [
      scapScanResultsBucket.bucketArn,
      `${scapScanResultsBucket.bucketArn}/*`,
    ],
  });

  scanStatusFunction.addToRolePolicy(s3Policy);
  instanceFindingsFunction.addToRolePolicy(s3Policy);

  scapScanResultsBucket.addEventNotification(
    s3.EventType.OBJECT_CREATED,
    new s3Notifications.SqsDestination(findingsQueue),
    { suffix: '.xml' }
  );

  const s3InvokeLambdaPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3:PutObject'],
    resources: [`${scapScanResultsBucket.bucketArn}/*`],
    principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
    conditions: {
      StringEquals: {
        'aws:SourceArn': instanceFindingsFunction.functionArn
      }
    }
  });

  scapScanResultsBucket.addToResourcePolicy(s3InvokeLambdaPolicy);

  // Define the CloudWatch Rule to listen for SSM Command state changes
  const ssmStateChangeRule = new events.Rule(
    customResourceStack,
    "SSMCommandStateChangeRule",
    {
      eventPattern: {
        source: ["aws.ssm"],
        detailType: ["EC2 Command Status-change Notification", "EC2 Command Invocation Status-change Notification"],
      },
      targets: [
        new targets.LambdaFunction(scanStatusFunction, {
          event: events.RuleTargetInput.fromEventPath('$'),
        }),
      ],
    }
  );

const scapScanSSMDocument = new ssm.CfnDocument(customResourceStack, 'SCAPScanDocument', {
  content: {
    schemaVersion: '2.2',
    description: 'OpenSCAP scan and report upload to S3',
    parameters: {
      region: {
        type: 'String',
        description: 'The AWS region to use',
        default: 'us-east-2'
      },
      s3bucket: {
        type: 'String',
        description: 'The S3 bucket to upload the report to',
        default: scapScanResultsBucket.bucketName
      },
      OS: {
        type: 'String',
        description: 'The operating system to use'
      },
      Benchmark: {
        type: 'String',
        description: 'The benchmark to use'
      }
    },
    mainSteps: [
      {
        action: 'aws:runShellScript',
        name: 'mkdir_openSCAP',
        inputs: {
          runCommand: [
            "if [ ! -d openscap ]; then mkdir openscap; fi"
          ]
        }
      },
      {
        action: 'aws:runShellScript',
        name: "Install_OpenSCAP",
        inputs: {
          runCommand: [
            "cd openscap && sudo yum install -y openscap-scanner"
          ]
        }
      },
      {
        action: 'aws:runShellScript',
        name: "Install_scap_security_guide",
        inputs: {
          runCommand: [
            'yes | sudo yum install -y scap-security-guide'
          ]
        }
      },
      {
        action: 'aws:runShellScript',
        name: 'Fix_broken_link',
        inputs: {
          runCommand: [
            "sudo sed -i 's|https://www.redhat.com/security/data/oval/com.redhat.rhsa-RHEL7.xml.bz2|https://www.redhat.com/security/data/oval/v2/RHEL7/rhel-7.oval.xml.bz2|g' /usr/share/xml/scap/ssg/content/ssg-amzn2-ds.xml"
          ]
        }
      },
      {
        action: 'aws:runShellScript',
        name: 'Run_OpenSCAP',
        inputs: {
          runCommand: [
            "oscap xccdf eval --profile {{Benchmark}} --fetch-remote-resources --results-arf arf.xml --report report.html /usr/share/xml/scap/ssg/content/{{OS}} || true"
          ]
        }
      },
      {
        action: 'aws:runShellScript',
        name: 'Upload_S3',
        inputs: {
          runCommand: [
            "INSTANCE_ID=$(ec2-metadata -i | cut -d ' ' -f 2)",
            "DATE=$(date +'%Y-%m-%d')",
            "aws configure set region {{region}}",
            "aws s3 cp report.html s3://{{s3bucket}}/$INSTANCE_ID/$DATE/arf.html",
            "aws s3 cp arf.xml s3://{{s3bucket}}/$INSTANCE_ID/$DATE/arf.xml"
          ]
        }
      },
      {
        action: 'aws:runShellScript',
        name: "Clean_up",
        inputs: {
          runCommand: [
            "yes | sudo yum erase openscap-scanner"
          ]
        }
      }
    ]
  },
  documentType: 'Command'
});

const myParameter = new ssm.StringParameter(customResourceStack, 'MyParameter', {
  parameterName: '/my-app/parameter-name',
  stringValue: scapScanSSMDocument.ref
});

const s3PolicyForEC2 = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: [
    "s3:GetObject",
    "s3:PutObject",
    "s3:ListBucket",
  ],
  resources: [
    scapScanResultsBucket.bucketArn,
    `${scapScanResultsBucket.bucketArn}/*`,
  ],
});

const ec2ManagedPolicy = new iam.ManagedPolicy(customResourceStack, 'AwsIceMangedPolicy', {
  managedPolicyName: 'EC2S3AccessPolicy',
  statements: [s3PolicyForEC2],
});