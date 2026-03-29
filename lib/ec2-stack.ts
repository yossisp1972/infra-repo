import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

// Custom Props interface - defines what parameters your stack accepts
export interface Ec2StackProps extends cdk.StackProps {
  // Required parameters
  vpcCidr: string;
  environment: string;
  
  // Optional parameters with defaults
  instanceType?: ec2.InstanceType;
  keyName?: string;
  maxAzs?: number;
}

export class Ec2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id, props);
    
    // Apply defaults
    const maxAzs = props.maxAzs ?? 2;
    const instanceType = props.instanceType ?? 
      ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);

    // Create a VPC with environment-specific configuration
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr: props.vpcCidr,        // From environment config
      maxAzs: maxAzs,              // From environment config
      natGateways: maxAzs > 1 ? 1 : 0,  // Save costs in dev (0 NAT), use NAT in others
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ]
    });

    // Create a security group for SSH access
    const securityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc,
      description: 'Allow SSH access to EC2 instance',
      allowAllOutbound: true
    });

    // Allow SSH from anywhere (consider restricting this in production!)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH from anywhere'
    );

    // Allow HTTP from anywhere
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from anywhere'
    );

    // Create EC2 instance with environment-specific configuration
    const instance = new ec2.Instance(this, 'MyEc2Instance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC // Put in public subnet for direct access
      },
      instanceType: instanceType,     // From environment config
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup,
      keyName: props.keyName,         // From environment config
    });
    
    // Add environment tag
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Output the instance details
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'EC2 Instance ID'
    });

    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: instance.instancePublicIp,
      description: 'EC2 Instance Public IP'
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID'
    });
  }
}
