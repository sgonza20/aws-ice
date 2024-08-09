import { defineFunction } from "@aws-amplify/backend";

export const describeInstances = defineFunction({
  name: "describe-instances",
  entry: "./handler.ts",
});