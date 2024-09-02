import { defineFunction } from "@aws-amplify/backend";
import { scapScanResultsBucket } from "../../backend";

export const invokeSSM = defineFunction({
  name: "invoke-ssm",
  entry: "./handler.ts",
  environment: {
    REPORT_BUCKET_NAME: scapScanResultsBucket.bucketName,
  },
});