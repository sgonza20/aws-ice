import {
  SSMClient,
  DescribeInstanceInformationCommand,
  DescribeInstanceInformationCommandOutput,
  InstanceInformation,
} from "@aws-sdk/client-ssm";
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import type { Schema } from "../../data/resource";
import { AttributeValue } from "@aws-sdk/client-dynamodb";

const ssmClient = new SSMClient();
const dynamoDBClient = new DynamoDBClient();

const INSTANCE_TABLE_NAME = process.env.INSTANCE_TABLE_NAME!;

export const fetchInstances = async () => {
  try {
    let allInstances = new Array<InstanceInformation>();
    let nextToken = undefined;

    do {
      const command = new DescribeInstanceInformationCommand({
        NextToken: nextToken,
      });

      const data: DescribeInstanceInformationCommandOutput =
        await ssmClient.send(command);

      if (data.InstanceInformationList) {
        allInstances = allInstances.concat(data.InstanceInformationList);
      }

      nextToken = data.NextToken;
    } while (nextToken);

    const fetchedInstances = allInstances.map(
      (instance) =>
        ({
          InstanceId: instance.InstanceId,
          PlatformName: instance.PlatformName,
          PlatformType: instance.PlatformType,
        } as Schema["Instance"]["type"])
    );

    return fetchedInstances;
  } catch (error) {
    console.error("Error fetching instances:", error);
    throw new Error("Failed to fetch instances");
  }
};

export const handler: Schema["GetInstances"]["functionHandler"] = async (
  event: any
) => {
  try {
    const instances = await fetchInstances();
    console.log("Fetched EC2 Instances:", instances);

    const scanParams = {
      TableName: INSTANCE_TABLE_NAME,
    };
    console.log("Scanning DynamoDB table:", scanParams);
    const scanResult = await dynamoDBClient.send(new ScanCommand(scanParams));
    const dynamoDBInstances = scanResult.Items?.map(item => item.InstanceId?.S) || [];

    const instancesToDelete = dynamoDBInstances.filter(instanceId =>
      instanceId && !instances.some(instance => instance.InstanceId === instanceId)
    );

    for (const instanceId of instancesToDelete) {
      const deleteParams = {
        TableName: INSTANCE_TABLE_NAME,
        Key: {
          "InstanceId": { S: instanceId as string } as AttributeValue
        },
      };
      console.log("Deleting instance from DynamoDB:", deleteParams);
      await dynamoDBClient.send(new DeleteItemCommand(deleteParams));
      console.log(`Deleted instance with InstanceId: ${instanceId}`);
    }

    return instances;
  } catch (error) {
    console.error("Error handling request:", error);
    return undefined;
  }
};
