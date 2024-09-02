import AWS from 'aws-sdk';
import xml2js from 'xml2js';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.FINDINGS_TABLE_NAME!;
const SIGNED_URL_EXPIRATION = 3600;

interface DynamoDBItem {
    InstanceId: string;
    Benchmark: string;
    Time: string;
    TotalFailed: number;
    TotalPassed: number;
    TotalUnknown: number;
    TotalLowSeverity: number;
    TotalMediumSeverity: number;
    TotalHighSeverity: number;
    Report_url: string;
    createdAt: string;
    updatedAt: string;
}

export const handler = async (event: any) => {
    console.log("Event received:", JSON.stringify(event, null, 2));

    if (event.Records && event.Records.length > 0) {
        const sqsRecord = event.Records[0];
        const s3Event = JSON.parse(sqsRecord.body);

        if (s3Event.Records && s3Event.Records.length > 0) {
            const record = s3Event.Records[0];
            const bucketName = record.s3.bucket.name;
            const fileKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

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

                const reports = parsedXml?.['arf:asset-report-collection']?.['arf:reports']?.[0]?.['arf:report'];

                if (!reports) {
                    console.log("No 'report' found under 'arf:reports'. Parsed XML structure might be different.");
                    throw new Error("Unable to locate 'report' in the parsed XML.");
                }
                let ruleResults: any[] = [];
                console.log("Starting loop to extract rule results");

                for (const report of reports) {
                    const testResults = report?.['arf:content']?.[0]?.['TestResult'];

                    if (testResults?.[0]?.['rule-result']) {
                        ruleResults = ruleResults.concat(testResults[0]['rule-result']);
                    }
                }

                if (ruleResults.length === 0) {
                    console.log("No 'rule-result' found in any 'TestResult'.");
                    return;
                }

                const instanceId = fileKey.split('/')[0];
                const benchmark = extractBenchmark(parsedXml);

                let totalFailed = 0;
                let totalPassed = 0;
                let totalUnknown = 0;
                let totalLowSeverity = 0;
                let totalMediumSeverity = 0;
                let totalHighSeverity = 0;

                console.log("Starting to process rule results");

                for (const item of ruleResults) {
                    const testId = item['$']?.['idref'];
                    const result = item['result']?.[0];
                    const severity = item['$']?.['severity'];

                    if (result === "fail") {
                        totalFailed++;
                    } else if (result === "pass") {
                        totalPassed++;
                    }

                    if (severity === "high") {
                        totalHighSeverity++;
                    } else if (severity === "medium") {
                        totalMediumSeverity++;
                    } else if (severity === "low") {
                        totalLowSeverity++;
                    } else if (severity === "unknown") {
                        totalUnknown++;
                    }
                }

                const reportUrl = await generatePresignedUrl(bucketName, fileKey.replace('.xml', '.html'));
                const currentTime = new Date().toISOString();

                const dynamoDbItem: DynamoDBItem = {
                    InstanceId: instanceId,
                    Benchmark: benchmark,
                    Time: currentTime,
                    TotalFailed: totalFailed,
                    TotalPassed: totalPassed,
                    TotalUnknown: totalUnknown,
                    TotalLowSeverity: totalLowSeverity,
                    TotalMediumSeverity: totalMediumSeverity,
                    TotalHighSeverity: totalHighSeverity,
                    Report_url: reportUrl,
                    createdAt: currentTime,
                    updatedAt: currentTime
                };

                const putParams = {
                    TableName: TABLE_NAME,
                    Item: dynamoDbItem
                };

                await dynamoDb.put(putParams).promise();
                console.log("DynamoDB item saved successfully");

                sendMetric(totalHighSeverity, 'SCAP High Finding', instanceId);
                sendMetric(totalMediumSeverity, 'SCAP Medium Finding', instanceId);
                sendMetric(totalLowSeverity, 'SCAP Low Finding', instanceId);

                console.log("Processing completed successfully.");
            } catch (error) {
                console.error("Error processing S3 object or DynamoDB operation:", error);
            }
        } else {
            console.error("No S3 records found in S3 event.");
        }
    } else {
        console.error("No SQS records found in event.");
    }
};

async function generatePresignedUrl(bucketName: string, key: string): Promise<string> {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
            Expires: SIGNED_URL_EXPIRATION
        };
        const url = await s3.getSignedUrlPromise('getObject', params);
        return url;
    } catch (error) {
        console.error("Error generating pre-signed URL:", error);
        throw error;
    }
}

function extractBenchmark(parsedXml: any): string {

    const reports = parsedXml?.['arf:asset-report-collection']?.['arf:reports']?.[0]?.['arf:report'];

    if (!reports) {
        console.log("No reports found in the parsed XML.");
        return 'Unknown Benchmark';
    }

    for (const report of reports) {
        const testResults = report?.['arf:content']?.[0]?.['TestResult'];
        console.log("Found TestResults:", testResults);

        if (testResults) {
            for (const testResult of testResults) {
                const testResultAttributes = testResult['$'];
                const benchmarkId = testResultAttributes?.['id'];

                return benchmarkId;
            }
        }
    }

    console.log("No benchmark found in the parsed XML.");
    return 'Unknown Benchmark';
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
