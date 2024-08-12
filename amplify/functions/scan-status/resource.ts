import { defineFunction } from "@aws-amplify/backend";

export const scanStatus = defineFunction({
  name: "scan-status",
  entry: "./handler.ts",
});