import {
  SSMClient,
  SendCommandCommand,
  SendCommandCommandOutput,
  GetParameterCommand,
  GetParameterCommandOutput,
} from "@aws-sdk/client-ssm";
import {
  IAMClient,
  ListAttachedRolePoliciesCommand, 
  AttachRolePolicyCommand,
  ListPoliciesCommand,
  ListPoliciesCommandOutput,
} from "@aws-sdk/client-iam";

import type { Schema } from "../../data/resource";

const ssmClient = new SSMClient();
const iamClient = new IAMClient();

export const handler: Schema["InvokeSSM"]["functionHandler"] = async (
  event: any
) => {
  const { InstanceId, OS, Benchmark, RoleName } = event.arguments;

  const parameterName = "/my-app/parameter-name";
  const getParameterCommand = new GetParameterCommand({ Name: parameterName });
  const getParameterResponse: GetParameterCommandOutput = await ssmClient.send(getParameterCommand);
  const DocumentName = getParameterResponse.Parameter?.Value;


  if (!InstanceId) {
    return {
      statusCode: 400,
      body: "Missing InstanceID",
    };
  }
  if (!RoleName) {
    return {
      statusCode: 400,
      body: "Missing RoleName",
    };
  }
  if (!DocumentName) {
    return {
      statusCode: 400,
      body: "Missing Document Name",
    };
  }
  if (!OS) {
    return {
      statusCode: 400,
      body: "Missing OS",
    };
  }
  if (!Benchmark) {
    return {
      statusCode: 400,
      body: "Missing Benchmark",
    };
  }

  try {
    const listPoliciesCommand = new ListPoliciesCommand({});
    const listPoliciesResponse: ListPoliciesCommandOutput = await iamClient.send(listPoliciesCommand);

    const policy = listPoliciesResponse.Policies?.find(
      (policy) => policy.PolicyName === "EC2S3AccessPolicy"
    );

    if (!policy) {
      return {
        statusCode: 500,
        body: "Policy 'EC2S3AccessPolicy' not found",
      };
    }

    const policyArn = policy.Arn;

    const managedRoleName = "AWSSystemsManagerDefaultEC2InstanceManagementRole";

    const listAttachedManagedRolePoliciesCommand = new ListAttachedRolePoliciesCommand({
      RoleName: managedRoleName,
    });

    const listAttachedManagedRolePoliciesResponse = await iamClient.send(listAttachedManagedRolePoliciesCommand);

    const listAttacheddRolePoliciesCommand = new ListAttachedRolePoliciesCommand({
      RoleName: RoleName,
    });

    const listAttachedRolePoliciesResponse = await iamClient.send(listAttacheddRolePoliciesCommand);

    const policyAttached = listAttachedRolePoliciesResponse.AttachedPolicies?.some(
      (policy) => policy.PolicyArn === policyArn
    );

    const policyAttachedManaged = listAttachedManagedRolePoliciesResponse.AttachedPolicies?.some(
      (policy) => policy.PolicyArn === policyArn
    );

    console.log("Policy attached:", policyAttached);

    if (!policyAttached) {
      const attachRolePolicyCommand = new AttachRolePolicyCommand({
        RoleName: RoleName,
        PolicyArn: policyArn,
      });
      await iamClient.send(attachRolePolicyCommand);
      console.log(`Policy ${policyArn} attached to role ${RoleName}`);
    } else if (!policyAttachedManaged) {
      const attachRolePolicyCommand = new AttachRolePolicyCommand({
        RoleName: managedRoleName,
        PolicyArn: policyArn,
      });
      await iamClient.send(attachRolePolicyCommand);
      console.log(`Policy ${policyArn} attached to role ${managedRoleName}`);
    }

    console.log("Invoking SSM document with arguments:", event.arguments);
    const command = new SendCommandCommand({
      InstanceIds: [InstanceId],
      DocumentName: DocumentName,
      Parameters: {
        OS: [OS],
        Benchmark: [Benchmark],
      },
    });

    const data: SendCommandCommandOutput = await ssmClient.send(command);
    const commandId = data.Command?.CommandId;


    console.log("Command ID", commandId);
    if (!commandId) {
      return {
        statusCode: 500,
        body: "Failed to retrieve CommandId",
      };
    }
    return {
      statusCode: 200,
      body: commandId,
    };
  } catch (error) {
    console.error("Error invoking SSM document:", error);
    return {
      statusCode: 500,
      body: "Failed to invoke SSM document",
      }
  }
};
