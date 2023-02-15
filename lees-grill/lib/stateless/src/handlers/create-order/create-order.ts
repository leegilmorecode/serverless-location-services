import * as AWS from 'aws-sdk';

import {
  APIGatewayEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { CreateOrderInput, Customer, Order } from '../../types';

import { config } from '../../config';
import { v4 as uuid } from 'uuid';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const loction = new AWS.Location();

// lets add the restaurant co-ords hardcoded for the demo (lee's grill)
// i.e. where we deliver from, so we can calc approx distance and delivery time
// this would be stored in paramter store in a lookup table in production
const restaurantLongitude = -1.61236;
const restaurantLatitude = 54.96999;

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const correlationId = uuid();
    const method = 'create-order.handler';
    const prefix = `${correlationId} - ${method}`;

    console.log(`${prefix} - started`);

    if (!event?.pathParameters || !event?.pathParameters.id)
      throw new Error('no id in the path parameters of the event');

    // we wont validate this with it being a demo only
    if (!event.body) throw new Error('no order supplied');

    // we get the specific customer id from the path parameters in the event from api gateway
    const { id: customerId } = event.pathParameters;

    // we take the body (payload) from the event coming through from api gateway
    const item = JSON.parse(event.body) as CreateOrderInput;

    // get the customer record so we can get their stored co-ords
    const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: config.get('ddbTableName'),
      Key: {
        id: customerId,
      },
    };

    console.log(`${prefix} - get customer: ${customerId}`);

    const { Item } = await dynamoDb.get(params).promise();

    if (!Item) throw new Error('customer not found');

    const customer = { ...Item } as Customer;

    const calcParams: AWS.Location.CalculateRouteRequest = {
      CalculatorName: config.get('routeCalculator'),
      DeparturePosition: [restaurantLongitude, restaurantLatitude], // depart from the restaurant
      DestinationPosition: [customer.longitude, customer.latitude], // to the customers address
    };

    // calculate the fastest route between the customer address and the restaurant
    const { Summary: summary }: AWS.Location.CalculateRouteResponse =
      await loction.calculateRoute(calcParams).promise();

    const {
      Distance: distance,
      DistanceUnit: distanceUnit,
      DurationSeconds: durationSeconds,
    } = summary;

    // create the order object for storing in dynamodb along with the delivery metrics
    const order: Order = {
      id: uuid(),
      customerId,
      productId: item.productId,
      distance,
      distanceUnit,
      durationInMinutes: Math.round(durationSeconds / 60),
    };

    console.log(`${prefix} - order: ${JSON.stringify(order)}`);

    const ddbParams: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: config.get('ddbTableName'),
      Item: order,
    };

    await dynamoDb.put(ddbParams).promise();

    return {
      body: JSON.stringify(order),
      statusCode: 201,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};
