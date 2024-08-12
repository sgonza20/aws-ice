import {
  SSMClient,
  SendCommandCommand,
  SendCommandCommandOutput,
} from "@aws-sdk/client-ssm";
import type { Schema } from "../../data/resource";

const ssmClient = new SSMClient();

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
      InstanceIds: [event.arguments.InstanceId],
      DocumentName: DocumentName,
      Parameters: {
        OS: [event.arguments.OS],
        Benchmark: [event.arguments.Benchmark],
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
