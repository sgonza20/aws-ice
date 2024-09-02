import {
  SSMClient,
  DescribeInstanceInformationCommand,
  DescribeInstanceInformationCommandOutput,
  InstanceInformation,
} from "@aws-sdk/client-ssm";
import {
  EC2Client,
  DescribeTagsCommand,
  DescribeTagsCommandOutput,
} from "@aws-sdk/client-ec2";
import type { Schema } from "../../data/resource";

const ssmClient = new SSMClient();
const ec2Client = new EC2Client();

export const fetchInstances = async () => {
  try {
    let allInstances = new Array<InstanceInformation>();
    let nextToken: string | undefined = undefined;

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

    const instanceIds = allInstances.map(instance => instance.InstanceId!).filter(id => id);
    if (instanceIds.length === 0) {
      return [];
    }

    const tagsCommand = new DescribeTagsCommand({
      Filters: [
        {
          Name: "resource-id",
          Values: instanceIds,
        },
        {
          Name: "key",
          Values: ["Name"],
        },
      ],
    });

    const tagsData: DescribeTagsCommandOutput = await ec2Client.send(tagsCommand);

    const nameTagsMap = new Map<string, string>();
    tagsData.Tags?.forEach(tag => {
      if (tag.Key === "Name" && tag.Value) {
        nameTagsMap.set(tag.ResourceId ?? "", tag.Value);
      }
    });

    const instancesWithNames = allInstances.map(instance => {
      const instanceId = instance.InstanceId!;
      return {
        InstanceId: instanceId,
        InstanceName: nameTagsMap.get(instanceId) || "Unknown",
        PlatformName: instance.PlatformName,
        PlatformType: instance.PlatformType,
      } as Schema["Instance"]["type"];
    });

    return instancesWithNames;
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
