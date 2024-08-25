import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { describeInstances } from '../functions/describe-instances/resource';
import { invokeSSM } from '../functions/invoke-ssm/resource';

const schema = a.schema({
  State: a.enum(["running", "stopped", "pending"]),
  Instance: a
    .model({
      InstanceId: a.string().required(),
      PlatformType: a.string(),
      PlatformName: a.string(),
      LastScanTime: a.string(),
      CommandId: a.string(),
      ScanStatus: a.enum(["Success", "Failed", "InProgress"]),
    })
    .identifier(["InstanceId"])
    .authorization((allow) => [allow.publicApiKey(), allow.authenticated()]),
  Finding: a
    .model({
      InstanceId: a.string().required(),
      SCAP_Rule_Name: a.string().required(),
      Time: a.string(),
      Severity: a.enum(["high", "medium", "low", "unknown"]),
      Result: a.string(),
      Report_url: a.string(),
    })
    .identifier(["InstanceId", "SCAP_Rule_Name"])
    .authorization((allow) => [allow.publicApiKey(), allow.authenticated()]),
  InstanceInformation: a.customType({
    InstanceId: a.string(),
    PlatformType: a.string(),
    PlatformName: a.string(),
    LastScanTime: a.string(),
    CommandId: a.string(),
    ScanStatus: a.enum(["Success", "Failed", "InProgress"]),
  }),
  HttpResponse: a.customType({
    statusCode: a.integer(),
    body: a.string(),
  }),
  GetInstances: a
    .query()
    .returns(a.ref("InstanceInformation").array())
    .handler(a.handler.function(describeInstances))
    .authorization((allow) => [allow.publicApiKey(), allow.authenticated()]),
  InvokeSSM: a
    .query()
    .arguments({
      InstanceId: a.string().required(),
      OS: a.string().required(),
      Benchmark: a.string().required(),
    })
    .returns(a.ref("HttpResponse"))
    .handler(a.handler.function(invokeSSM))
    .authorization((allow) => [allow.publicApiKey(), allow.authenticated()])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
