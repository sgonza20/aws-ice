import AWS from 'aws-sdk';
import xml2js from 'xml2js';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.FINDINGS_TABLE_NAME!;

interface DynamoDBItem {
    InstanceId: string;
    SCAP_Rule_Name: string;
    Time: string;
    Severity: string;
    Result: string;
    Report_url: string;
    createdAt: string;
    updatedAt: string;
}

exports.handler = async (event: any) => {
    console.log("Event received:", JSON.stringify(event, null, 2));

    const record = event.Records[0].s3;
    const bucketName = record.bucket.name;
    const fileKey = decodeURIComponent(record.object.key.replace(/\+/g, " "));

    try {
        console.log("Attempting to get S3 object", { bucketName, fileKey });

        const params = {
            Bucket: bucketName,
            Key: fileKey
        };

        const data = await s3.getObject(params).promise();
        console.log("S3 object retrieved successfully");

        const xml = data.Body?.toString('utf-8') || '';
        console.log("XML content retrieved");

        const parser = new xml2js.Parser({ explicitArray: true });
        const parsedXml = await parser.parseStringPromise(xml);
        console.log("XML parsed successfully");

        // Navigate through the XML structure to find the 'rule-result' entries
        const reports = parsedXml?.['arf:asset-report-collection']?.['arf:reports']?.[0]?.['arf:report'];

        if (!reports) {
            console.log("No 'report' found under 'arf:reports'. Parsed XML structure might be different.");
            console.log("Keys under 'arf:asset-report-collection':", Object.keys(parsedXml['arf:asset-report-collection']));
            throw new Error("Unable to locate 'report' in the parsed XML.");
        }

        let ruleResults: any[] = [];

        reports.forEach((report: any) => {
            const testResults = report?.['arf:content']?.[0]?.['TestResult'];

            if (testResults?.[0]?.['rule-result']) {
                ruleResults = ruleResults.concat(testResults[0]['rule-result']);
            }
        });

        if (ruleResults.length === 0) {
            console.log("No 'rule-result' found in any 'TestResult'.");
            return;
        }

        const instanceId = fileKey.split('/')[0];

        let high = 0;
        let medium = 0;
        let low = 0;
        let unknown = 0;

        const dynamoDbItems: DynamoDBItem[] = [];
        console.log("Starting loop");

        for (const item of ruleResults) {
            const testId = item['$']?.['idref'];

            const result = item['result']?.[0];
            const severity = item['severity']?.[0]; 

            if (result === "fail" || result === "pass") {
                saveToDynamoDB(dynamoDbItems, instanceId, item, bucketName, fileKey);

                if (severity === "high") {
                    high++;
                } else if (severity === "medium") {
                    medium++;
                } else if (severity === "low") {
                    low++;
                } else if (severity === "unknown") {
                    unknown++;
                }
            }
        }

        sendMetric(high, 'SCAP High Finding', instanceId);
        sendMetric(medium, 'SCAP Medium Finding', instanceId);
        sendMetric(low, 'SCAP Low Finding', instanceId);

        const batchWritePromises = dynamoDbItems.map(item => {
            const params = {
                TableName: TABLE_NAME,
                Item: item
            };
            return dynamoDb.put(params).promise();
        });

        await Promise.all(batchWritePromises);

        console.log("Processing completed successfully.");
    } catch (error) {
        console.error("Error processing S3 object or DynamoDB operation:", error);
    }
};

function saveToDynamoDB(dynamoDbItems: DynamoDBItem[], instanceId: string, item: any, bucketName: string, fileKey: string) {
  const currentTime = new Date().toISOString();
    dynamoDbItems.push({
        InstanceId: instanceId,
        SCAP_Rule_Name: item['$']?.['idref'] || 'unknown',
        Time: item['$']?.['time'] || 'unknown',
        Severity: item['$']?.['severity'] || 'unknown',
        Result: item['result']?.[0] || 'unknown',
        Report_url: `s3://${bucketName}/${fileKey.replace('.xml', '.html')}`,
        createdAt: currentTime,
        updatedAt: currentTime
    });
}

function sendMetric(value: number, title: string, instanceId: string) {
    const params = {
        Namespace: 'Compliance',
        MetricData: [{
            MetricName: title,
            Dimensions: [{
                Name: 'InstanceId',
                Value: instanceId
            }],
            Value: value
        }]
    };

    cloudwatch.putMetricData(params, (err, data) => {
        if (err) console.error("Error sending metric to CloudWatch:", err);
        else console.log("Metric sent:", data);
    });
}
