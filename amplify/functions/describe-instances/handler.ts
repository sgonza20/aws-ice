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
  DescribeIamInstanceProfileAssociationsCommand,
} from "@aws-sdk/client-ec2";
import type { Schema } from "../../data/resource";

const ssmClient = new SSMClient();
const ec2Client = new EC2Client();

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

    const instancesWithNamesAndRoles = await Promise.all(
      allInstances.map(async (instance) => {
        const instanceId = instance.InstanceId;

        const tagsCommand = new DescribeTagsCommand({
          Filters: [
            {
              Name: "resource-id",
              Values: [instanceId ?? "Unknown"],
            },
            {
              Name: "key",
              Values: ["Name"],
            },
          ],
        });

        const tagsData: DescribeTagsCommandOutput = await ec2Client.send(
          tagsCommand
        );
        const nameTag = tagsData.Tags?.find((tag) => tag.Key === "Name");

        const roleCommand = new DescribeIamInstanceProfileAssociationsCommand({
          Filters: [
            {
              Name: "instance-id",
              Values: [instanceId ?? "Unknown"],
            },
          ],
        });

        const roleResponse = await ec2Client.send(roleCommand);
        const roleName = (roleResponse.IamInstanceProfileAssociations?.[0]?.IamInstanceProfile?.Arn ?? "").split("/").pop() ?? "";
        return {
          InstanceId: instance.InstanceId,
          InstanceName: nameTag?.Value || "Unknown",
          RoleName: roleName || "Unknown",
          PlatformName: instance.PlatformName,
          PlatformType: instance.PlatformType,
        } as Schema["Instance"]["type"];
      })
    );

    return instancesWithNamesAndRoles;
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
