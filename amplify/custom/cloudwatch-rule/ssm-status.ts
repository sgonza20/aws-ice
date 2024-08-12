// amplify/backend/custom/cloudwatch-rule/index.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class CloudWatchRuleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Assuming the Lambda function is already defined in Amplify's `functions` folder
    const lambdaFunctionArn = cdk.Fn.getAtt('MyLambdaFunction', 'Arn').toString();

    // Define the CloudWatch event rule
    const rule = new events.Rule(this, 'SSMRunCommandStatusChangeRule', {
      eventPattern: {
        source: ['aws.ssm'],
        detailType: ['EC2 Command Invocation Status-change Notification'],
        detail: {
          status: ['Success', 'Failed', 'TimedOut'],
        },
      },
    });

    // Add the Lambda function as a target
    rule.addTarget(new targets.LambdaFunction(lambda.Function.fromFunctionArn(this, 'TargetLambda', lambdaFunctionArn)));
  }
}
