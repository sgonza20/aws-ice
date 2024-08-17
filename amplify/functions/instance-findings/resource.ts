import { defineFunction } from "@aws-amplify/backend";

export const instanceFindings = defineFunction({
  name: "instance-findings",
  entry: "./handler.ts",
});