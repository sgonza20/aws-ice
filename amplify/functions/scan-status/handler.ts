import {
    SSMClient,
    ListCommandsCommand,
    ListCommandsCommandOutput,
  } from "@aws-sdk/client-ssm";
  import {
    DynamoDBClient,
    UpdateItemCommand,
    GetItemCommand,
  } from "@aws-sdk/client-dynamodb";
  
  const ssmClient = new SSMClient({});
  const dynamoDbClient = new DynamoDBClient({});
  
  const TABLE_NAME = "YourDynamoDBTableName";
  
  export const handler = async (event: any) => {
    console.log("Event received:", JSON.stringify(event, null, 2));
  
    try {
      const commandId = event.detail.commandId;
  
      if (!commandId) {
        return {
          statusCode: 400,
          body: "CommandId is missing from the event.",
        };
      }
  
      // Check if the commandId exists in the DynamoDB table
      const commandExists = await checkIfCommandExists(commandId);
      if (!commandExists) {
        return {
          statusCode: 404,
          body: "CommandId not found in DynamoDB.",
        };
      }
  
      // Retrieve the status of the SSM command
      const command = new ListCommandsCommand({ CommandId: commandId });
      const data: ListCommandsCommandOutput = await ssmClient.send(command);
  
      if (data.Commands && data.Commands.length > 0) {
        const status = data.Commands[0].Status || "Unknown";
  
        // Update the status in the model (DynamoDB)
        await updateModelWithStatus(commandId, status);
  
        return {
          statusCode: 200,
          body: `Status updated successfully to ${status}.`,
        };
      } else {
        return {
          statusCode: 404,
          body: "Command not found.",
        };
      }
    } catch (error) {
      console.error("Error processing status update:", error);
      return {
        statusCode: 500,
        body: "Failed to process status update.",
      };
    }
  };
  
  // Check if the Command ID exists in DynamoDB
  async function checkIfCommandExists(commandId: string) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        CommandId: { S: commandId },
      },
    };
    const result = await dynamoDbClient.send(new GetItemCommand(params));
    return !!result.Item;
  }
  
  // Update the model (DynamoDB) with the status
  async function updateModelWithStatus(commandId: string, status: string) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        CommandId: { S: commandId },
      },
      UpdateExpression: "set #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": { S: status },
      },
    };
    await dynamoDbClient.send(new UpdateItemCommand(params));
  }
  