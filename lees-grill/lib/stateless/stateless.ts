import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as location from 'aws-cdk-lib/aws-location';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';

export interface StackProps extends cdk.StackProps {
  table: dynamodb.Table;
}

export class LeesGrillStackStateless extends cdk.Stack {
  private readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.table = props.table;

    // create a place index to allow us to search for locations
    const placeIndex: location.CfnPlaceIndex = new location.CfnPlaceIndex(
      this,
      'PlaceIndex',
      {
        indexName: 'PlaceIndex',
        description: 'Place index for Lees Grill',
        dataSource: 'Here', // 'Here', 'Esri' or 'Grab'
      }
    );
    placeIndex.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // create a location route calculator
    const routeCalculator: location.CfnRouteCalculator =
      new location.CfnRouteCalculator(this, 'RouteCalculator', {
        dataSource: 'Here', // 'Here', 'Esri' or 'Grab'
        description: 'Route calculator for Lees Grill',
        calculatorName: 'RouteCalculator',
      });
    routeCalculator.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // create the 'create customer' lambda function handler
    const createCustomerHandler: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'CreateCustomerLambda', {
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: path.join(
          __dirname,
          'src/handlers/create-customer/create-customer.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: ['aws-sdk'],
        },
        environment: {
          PLACE_INDEX_NAME: placeIndex.indexName,
          TABLE_NAME: this.table.tableName,
        },
      });

    // create the 'create order' lambda function handler
    const createOrderHandler: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'CreateOrderLambda', {
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: path.join(
          __dirname,
          'src/handlers/create-order/create-order.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: ['aws-sdk'],
        },
        environment: {
          TABLE_NAME: this.table.tableName,
          ROUTE_CALCULATOR: routeCalculator.calculatorName,
        },
      });

    // allow the create customer lambda to write to dynamodb
    this.table.grantWriteData(createCustomerHandler);

    // allow the create order lambda to read and write to dynamodb
    this.table.grantReadWriteData(createOrderHandler);

    createCustomerHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [placeIndex.attrIndexArn],
        actions: ['geo:SearchPlaceIndexForText'],
      })
    );

    createOrderHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [routeCalculator.attrArn],
        actions: ['geo:CalculateRoute'],
      })
    );

    // create the api for our business lee's grill
    const api: apigw.RestApi = new apigw.RestApi(this, 'Api', {
      description: 'lees grill api',
      restApiName: 'lees-grill-api',
      deploy: true,
      endpointTypes: [apigw.EndpointType.REGIONAL],
      deployOptions: {
        stageName: 'prod',
        dataTraceEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        tracingEnabled: true,
        metricsEnabled: true,
      },
    });

    // create the resources for the api
    const customers: apigw.Resource = api.root.addResource('customers');
    const customer: apigw.Resource = customers.addResource('{id}');
    const orders: apigw.Resource = customer.addResource('orders');

    // add the endpoint for creating a customer (post) on prod/customers/
    customers.addMethod(
      'POST',
      new apigw.LambdaIntegration(createCustomerHandler, {
        proxy: true,
        allowTestInvoke: false,
      })
    );

    // add the endpoint for creating a customer order (post) on prod/customers/{id}/orders
    orders.addMethod(
      'POST',
      new apigw.LambdaIntegration(createOrderHandler, {
        proxy: true,
        allowTestInvoke: false,
      })
    );
  }
}
