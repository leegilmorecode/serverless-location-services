import * as AWS from 'aws-sdk';

import {
  APIGatewayEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { CreateCustomerInput, Customer } from '../../types';

import { config } from '../../config';
import { v4 as uuid } from 'uuid';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const loction = new AWS.Location();

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const correlationId = uuid();
    const method = 'create-customer.handler';
    const prefix = `${correlationId} - ${method}`;

    console.log(`${prefix} - started`);

    // we wont validate this with it being a demo only
    if (!event.body) throw new Error('no customer supplied');

    // we take the body (payload) from the event coming through from api gateway
    const item = JSON.parse(event.body) as CreateCustomerInput;

    const params: AWS.Location.Types.SearchPlaceIndexForTextRequest = {
      Text: item.postCode,
      IndexName: config.get('placeIndex'),
    };

    // we perform a search on the customer postcode for the co-ords (long & lat)
    const { Results: results }: AWS.Location.SearchPlaceIndexForTextResponse =
      await loction.searchPlaceIndexForText(params).promise();

    // pull the required information from the search result of the customer address
    const [
      {
        Place: {
          Country: country,
          Region: region,
          Geometry: { Point: point },
        },
      },
    ] = results;

    const longitude = point ? point[0] : 0;
    const latitude = point ? point[1] : 0;

    // create the basic customer object for storing in dynamodb, alongside the address co-ords
    const customer: Customer = {
      id: uuid(),
      ...item,
      region,
      country,
      longitude,
      latitude,
    };

    console.log(`${prefix} - customer: ${JSON.stringify(customer)}`);

    const ddbParams: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: config.get('ddbTableName'),
      Item: customer,
    };

    await dynamoDb.put(ddbParams).promise();

    return {
      body: JSON.stringify(customer),
      statusCode: 201,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};
