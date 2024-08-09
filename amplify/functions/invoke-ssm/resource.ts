import { defineFunction } from "@aws-amplify/backend";

export const invokeSSM = defineFunction({
  name: "invoke-ssm",
  entry: "./handler.ts",
});