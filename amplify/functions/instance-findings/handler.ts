import AWS from 'aws-sdk';
import xml2js from 'xml2js';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.FINDINGS_TABLE_NAME!;
const SIGNED_URL_EXPIRATION = 3600;

interface DynamoDBItem {
    InstanceId: string;
    SCAP_Rule_Name: string;
    Benchmark: string; // Added Benchmark field
    Time: string;
    Severity: string;
    Result: string;
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
                    console.log("Keys under 'arf:asset-report-collection':", Object.keys(parsedXml['arf:asset-report-collection']));
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

                let high = 0;
                let medium = 0;
                let low = 0;
                let unknown = 0;

                const dynamoDbItems: DynamoDBItem[] = [];
                console.log("Starting to process rule results");

                for (const item of ruleResults) {
                    const testId = item['$']?.['idref'];
                    const result = item['result']?.[0];
                    const severity = item['severity']?.[0];

                    if (result === "fail" || result === "pass") {
                        const reportUrl = await generatePresignedUrl(bucketName, fileKey.replace('.xml', '.html'));

                        saveToDynamoDB(dynamoDbItems, instanceId, item, benchmark, reportUrl);

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
        } else {
            console.error("No S3 records found in S3 event.");
        }
    } else {
        console.error("No SQS records found in event.");
    }
};

function saveToDynamoDB(dynamoDbItems: DynamoDBItem[], instanceId: string, item: any, benchmark: string, reportUrl: string) {
    const currentTime = new Date().toISOString();
    dynamoDbItems.push({
        InstanceId: instanceId,
        SCAP_Rule_Name: item['$']?.['idref'] || 'unknown',
        Benchmark: benchmark, // Added Benchmark field
        Time: item['$']?.['time'] || 'unknown',
        Severity: item['$']?.['severity'] || 'unknown',
        Result: item['result']?.[0] || 'unknown',
        Report_url: reportUrl,
        createdAt: currentTime,
        updatedAt: currentTime
    });
}

async function generatePresignedUrl(bucketName: string, key: string) {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
            Expires: SIGNED_URL_EXPIRATION
        };
        const url = s3.getSignedUrlPromise('getObject', params);
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
                const fullId = testResultAttributes?.['id'];

                if (fullId) {
                    const benchmarkId = fullId.split('.').pop() || 'Unknown Benchmark';
                    return benchmarkId;
                }
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
