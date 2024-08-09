import {
  SSMClient,
  DescribeInstanceInformationCommand,
  DescribeInstanceInformationCommandOutput,
  InstanceInformation,
} from "@aws-sdk/client-ssm";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../data/resource";

const ssmClient = new SSMClient();
const client = generateClient<Schema>();

export const fetchInstances = async () => {
  try {
    let allInstances = new Array<InstanceInformation>();
    let nextToken = undefined;

    do {
      const command = new DescribeInstanceInformationCommand({
        NextToken: nextToken,
      });

      const data: DescribeInstanceInformationCommandOutput = await ssmClient.send(command);

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

export const handler: Schema["GetInstances"]["functionHandler"] = async (event: any) => {
  try {
    const { data: existingInstances } = await client.models.Instance.list();
    const existingInstanceIds = existingInstances.map((instance) => instance.InstanceId);

    const fetchedInstances = await fetchInstances();
    const fetchedInstanceIds = fetchedInstances.map((instance) => instance.InstanceId);

    console.log("Fetched EC2 Instances:", fetchedInstances);

    const instancesToDelete = existingInstanceIds.filter((instanceId) => !fetchedInstanceIds.includes(instanceId));

    for (const instanceId of instancesToDelete) {
      const instanceToDelete = { InstanceId: instanceId };
      const { data: deletedInstance, errors } = await client.models.Instance.delete(instanceToDelete);

      if (errors) {
        console.error(`Error deleting instance ${instanceId}:`, errors);
      } else {
        console.log(`Deleted instance ${instanceId}:`, deletedInstance);
      }
    }

    // Step 4: Return the fetched instances
    return fetchedInstances;
  } catch (error) {
    console.error("Error handling request:", error);
    return undefined;
  }
};
