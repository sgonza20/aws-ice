import {
  SSMClient,
  DescribeInstanceInformationCommand,
  DescribeInstanceInformationCommandOutput,
  InstanceInformation,
} from "@aws-sdk/client-ssm";
import type { Schema } from "../../data/resource";

const ssmClient = new SSMClient();

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

    return allInstances.map(
      (instance) =>
        ({
          InstanceId: instance.InstanceId,
          PlatformName: instance.PlatformName,
          PlatformType: instance.PlatformType,
        } as Schema["Instance"]["type"])
    );
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
    return instances;
  } catch (error) {
    console.error("Error handling request:", error);
    return undefined;
  }
};