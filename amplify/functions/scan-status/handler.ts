import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { Schema } from "../../data/resource";

// Initialize the DynamoDB client
const dynamoDBClient = new DynamoDBClient({});

const INSTANCE_TABLE_NAME = process.env.INSTANCE_TABLE_NAME!;

export const handler: Schema["UpdateSSMStatus"]["functionHandler"] = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const records = event.Records;
  for (const record of records) {
    if (record.eventName !== 'MODIFY') {
      continue;
    }

    const newImage = record.dynamodb.NewImage;
    const unmarshalledData = unmarshall(newImage);

    const commandId = unmarshalledData.CommandId;
    const status = unmarshalledData.Status;
    const instanceId = unmarshalledData.InstanceId;

    if (!commandId || !status || !instanceId) {
      console.error("Missing required fields in event:", unmarshalledData);
      continue;
    }

    console.log(`Updating status for InstanceId: ${instanceId}, CommandId: ${commandId}, Status: ${status}`);

    try {
      const updateParams = {
        TableName: process.env.INSTANCE_TABLE_NAME,
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
    }
  }

  return { statusCode: 200, body: "Success" };
};
