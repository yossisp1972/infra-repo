#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Ec2Stack } from '../lib/ec2-stack';
import {
  EncryptionAspect,
  TaggingAspect,
  SecurityGroupAspect,
  ImdsAspect,
  PublicAccessAspect,
  IamAspect,
  DeletionProtectionAspect,
  LoggingAspect
} from '../lib/aspects/security-aspects';

const app = new cdk.App();

// Get environment from context (--context environment=dev)
const envName = app.node.tryGetContext('environment') || 'dev';

// Environment configurations
const environments = {
  dev: {
    account: '111111111111',  // Dev AWS account
    region: 'us-east-1',
    vpcCidr: '10.0.0.0/16',
    maxAzs: 1,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
    keyName: 'dev-key',
    enableMonitoring: false,
  },
  staging: {
    account: '222222222222',  // Staging AWS account
    region: 'us-east-1',
    vpcCidr: '10.1.0.0/16',
    maxAzs: 2,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
    keyName: 'staging-key',
    enableMonitoring: true,
  },
  production: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '333333333333',  // Prod AWS account
    region: 'us-east-1',
    vpcCidr: '10.2.0.0/16',
    maxAzs: 3,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
    keyName: 'yossi',  // Your production key
    enableMonitoring: true,
  }
};

// Get config for the specified environment
const config = environments[envName as keyof typeof environments];

if (!config) {
  throw new Error(`Unknown environment: ${envName}. Valid: dev, staging, production`);
}

// Create stack with environment-specific settings
new Ec2Stack(app, `Ec2Stack-${envName}`, {
  env: {
    account: config.account,
    region: config.region,
  },
  vpcCidr: config.vpcCidr,
  environment: envName,
  instanceType: config.instanceType,
  keyName: config.keyName,
  maxAzs: config.maxAzs,
  description: `EC2 infrastructure for ${envName} environment`
});

// ========================================
// Apply Security Aspects to ALL Stacks
// ========================================

// 1. Enforce encryption on all resources
cdk.Aspects.of(app).add(new EncryptionAspect());

// 2. Enforce required tags
cdk.Aspects.of(app).add(new TaggingAspect([
  'Environment',
  'ManagedBy',
  'CostCenter',
  'Owner'
]));

// 3. Enforce secure security group rules (no SSH/RDP from internet)
cdk.Aspects.of(app).add(new SecurityGroupAspect([22, 3389]));

// 4. Enforce IMDSv2 on EC2 instances
cdk.Aspects.of(app).add(new ImdsAspect());

// 5. Prevent public access to resources
cdk.Aspects.of(app).add(new PublicAccessAspect());

// 6. Enforce IAM best practices
cdk.Aspects.of(app).add(new IamAspect());

// 7. Enable deletion protection for production
cdk.Aspects.of(app).add(new DeletionProtectionAspect());

// 8. Enforce logging and monitoring
cdk.Aspects.of(app).add(new LoggingAspect());

app.synth();
