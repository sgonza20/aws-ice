import {
  SSMClient,
  SendCommandCommand,
  SendCommandCommandOutput,
} from "@aws-sdk/client-ssm";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import type { Schema } from "../../data/resource";

const ssmClient = new SSMClient();
const StepFunctionClient = new SFNClient();

export const handler: Schema["InvokeSSM"]["functionHandler"] = async (
  event: any
) => {
  const { InstanceId, DocumentName, OS, Benchmark } = event.arguments;

  if (!InstanceId) {
    return {
      statusCode: 400,
      body: "Missing InstanceID",
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

  console.log("Invoking SSM document with arguments:", event.arguments);
  try {
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

    // Start Step Functions Execution
    const stepFunctionsInput = {
      commandId,
      instanceId: InstanceId,
    };

    try {
      const stepFunctionsCommand = new StartExecutionCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN, // Ensure this is set as an environment variable
        input: JSON.stringify(stepFunctionsInput),
      });

      const stepFunctionsResponse = await StepFunctionClient.send(stepFunctionsCommand);
      console.log("State Machine execution started:", stepFunctionsResponse.executionArn);

      return {
        statusCode: 200,
        body: JSON.stringify({ commandId, executionArn: stepFunctionsResponse.executionArn }),
      };
    } catch (stepFunctionError) {
      console.error("Error starting Step Function:", stepFunctionError);
      return {
        statusCode: 500,
        body: "Failed to start Step Function",
      };
    }
  } catch (error) {
    console.error("Error invoking SSM document:", error);
    return {
      statusCode: 500,
      body: "Failed to invoke SSM document",
    };
  }
};
