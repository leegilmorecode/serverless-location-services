#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { LeesGrillStackStateful } from '../lib/stateful/stateful';
import { LeesGrillStackStateless } from '../lib/stateless/stateless';

const app = new cdk.App();

const leesGrillStackStateful = new LeesGrillStackStateful(
  app,
  'LeesGrillStackStateful',
  {}
);
new LeesGrillStackStateless(app, 'LeesGrillStackStateless', {
  table: leesGrillStackStateful.table,
});
