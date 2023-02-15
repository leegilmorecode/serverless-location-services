import convict = require('convict');

export const config = convict({
  ddbTableName: {
    doc: 'The dynamodb table name',
    default: 'development',
    env: 'TABLE_NAME',
  },
  placeIndex: {
    doc: 'The place index for the AWS Location Service',
    default: 'index',
    env: 'PLACE_INDEX_NAME',
  },
  routeCalculator: {
    doc: 'The route calculator for the AWS Location Service',
    default: 'calc',
    env: 'ROUTE_CALCULATOR',
  },
});
