import { DynamoDB } from 'aws-sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';

const dynamoDb = new DynamoDB.DocumentClient();
const FINDINGS_TABLE = process.env.FINDINGS_TABLE_NAME as string;
const bucketName = process.env.S3_BUCKET_NAME;

export const processFindings: APIGatewayProxyHandler = async (event) => {
  const { InstanceId, FindingId, FindingType, FindingStatus, Details, Timestamp } = JSON.parse(event.body || '{}');

  if (!InstanceId || !FindingId || !FindingType || !FindingStatus || !Details || !Timestamp) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required parameters' }),
    };
  }

  const params = {
    TableName: FINDINGS_TABLE,
    Item: {
      InstanceId,
      FindingId,
      FindingType,
      FindingStatus,
      Details,
      Timestamp,
    },
  };

  try {
    await dynamoDb.put(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Finding processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing finding:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing finding' }),
    };
  }
};