import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoDBClient = new DynamoDBClient({});

const INSTANCE_TABLE_NAME = process.env.INSTANCE_TABLE_NAME!;

export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));


  const detail = event.detail;
  const commandId = detail["command-id"];
  const status = detail.status;
  const instanceId = event.resources[0].split("/")[1];

  if (!commandId || !status || !instanceId) {
    console.error("Missing required fields in event:", { commandId, status, instanceId });
    return { statusCode: 400, body: "Bad Request: Missing required fields" };
  }

  console.log(`Updating status for InstanceId: ${instanceId}, CommandId: ${commandId}, Status: ${status}`);

  try {
    const updateParams = {
      TableName: INSTANCE_TABLE_NAME,
      Key: {
        "InstanceId": { S: instanceId }
      },
      UpdateExpression: "SET ScanStatus = :status",
      ExpressionAttributeValues: {
        ":status": { S: status },
      },
      ReturnValues: "UPDATED_NEW" as const,
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(updateParams));
    console.log("Update result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Failed to update DynamoDB:", error);
    return { statusCode: 500, body: "Internal Server Error" };
  }

  return { statusCode: 200, body: "Success" };
};
