import AWS from 'aws-sdk';
import xml2js from 'xml2js';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.TABLE_NAME!;

interface DynamoDBItem {
    InstanceId: string;
    SCAP_Rule_Name: string;
    time: string;
    severity: string;
    result: string;
    report_url: string;
}

exports.handler = async (event: any) => {
    console.log("Event received:", JSON.stringify(event, null, 2));

    const record = event.Records[0].s3;
    const bucketName = record.bucket.name;
    const fileKey = decodeURIComponent(record.object.key.replace(/\+/g, " "));

    try {
        const params = {
            Bucket: bucketName,
            Key: fileKey
        };

        const data = await s3.getObject(params).promise();
        const xml = data.Body?.toString('utf-8') || '';

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xml);

        const testResult = result['xccdf:TestResult'];
        const instanceId = fileKey.split('/')[0];

        let high = 0;
        let medium = 0;
        let low = 0;
        let unknown = 0;

        const dynamoDbItems: DynamoDBItem[] = [];

        for (const item of testResult['item']) {
            const testId = item['$']['idref'];

            if (item['result'][0] === "fail") {
                saveToDynamoDB(dynamoDbItems, instanceId, item, bucketName, fileKey);

                if (item['severity'][0] === "high") {
                    high++;
                } else if (item['severity'][0] === "medium") {
                    medium++;
                } else if (item['severity'][0] === "low") {
                    low++;
                } else if (item['severity'][0] === "unknown") {
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
}

function saveToDynamoDB(dynamoDbItems: DynamoDBItem[], instanceId: string, item: any, bucketName: string, fileKey: string) {
    dynamoDbItems.push({
        InstanceId: instanceId,
        SCAP_Rule_Name: item['$']['idref'],
        time: item['$']['time'],
        severity: item['severity'][0],
        result: item['result'][0],
        report_url: `s3://${bucketName}/${fileKey.replace('.xml', '.html')}`
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
