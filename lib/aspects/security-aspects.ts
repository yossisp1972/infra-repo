import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';

/**
 * Aspect that enforces encryption on all resources
 */
export class EncryptionAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    // Enforce S3 bucket encryption
    if (node instanceof s3.CfnBucket) {
      if (!node.bucketEncryption) {
        cdk.Annotations.of(node).addError(
          'S3 buckets must have encryption enabled (AES256 or KMS)'
        );
      }
    }
    
    // Enforce EBS encryption
    if (node instanceof ec2.CfnInstance) {
      const blockDevices = node.blockDeviceMappings || [];
      blockDevices.forEach((device: any, index: number) => {
        if (device.ebs && !device.ebs.encrypted) {
          cdk.Annotations.of(node).addError(
            `EBS volume at index ${index} must be encrypted`
          );
        }
      });
    }
    
    // Enforce RDS encryption
    if (node instanceof rds.CfnDBInstance) {
      if (!node.storageEncrypted) {
        cdk.Annotations.of(node).addError(
          'RDS instances must have storage encryption enabled'
        );
      }
    }
    
    // Enforce RDS cluster encryption
    if (node instanceof rds.CfnDBCluster) {
      if (!node.storageEncrypted) {
        cdk.Annotations.of(node).addError(
          'RDS clusters must have storage encryption enabled'
        );
      }
    }
  }
}

/**
 * Aspect that enforces proper tagging
 */
export class TaggingAspect implements cdk.IAspect {
  private requiredTags: string[];
  
  constructor(requiredTags: string[]) {
    this.requiredTags = requiredTags;
  }
  
  visit(node: IConstruct): void {
    if (node instanceof cdk.Stack) {
      const tags = cdk.Tags.of(node).renderedTags;
      
      this.requiredTags.forEach(tagKey => {
        if (!tags[tagKey]) {
          cdk.Annotations.of(node).addError(
            `Stack must have required tag: ${tagKey}`
          );
        }
      });
    }
  }
}

/**
 * Aspect that enforces secure security group rules
 */
export class SecurityGroupAspect implements cdk.IAspect {
  private forbiddenPorts: number[];
  
  constructor(forbiddenPorts: number[] = [22, 3389]) {
    this.forbiddenPorts = forbiddenPorts;
  }
  
  visit(node: IConstruct): void {
    // Check security group ingress rules
    if (node instanceof ec2.CfnSecurityGroupIngress) {
      const rule = node as ec2.CfnSecurityGroupIngress;
      
      // Block SSH/RDP from internet
      if (rule.cidrIp === '0.0.0.0/0' || rule.cidrIpv6 === '::/0') {
        const fromPort = rule.fromPort || 0;
        const toPort = rule.toPort || 65535;
        
        this.forbiddenPorts.forEach(port => {
          if (fromPort <= port && port <= toPort) {
            cdk.Annotations.of(node).addError(
              `Port ${port} must not be open to 0.0.0.0/0. Restrict to specific IPs.`
            );
          }
        });
      }
      
      // Warn about overly permissive rules
      if ((rule.fromPort === 0 && rule.toPort === 65535) || rule.ipProtocol === '-1') {
        cdk.Annotations.of(node).addWarning(
          'Security group rule allows all ports. Consider restricting to specific ports.'
        );
      }
    }
    
    // Check security groups for egress rules
    if (node instanceof ec2.CfnSecurityGroup) {
      const sg = node as ec2.CfnSecurityGroup;
      
      // Warn if all outbound traffic is allowed
      const hasUnrestrictedEgress = sg.securityGroupEgress?.some(
        (rule: any) => rule.cidrIp === '0.0.0.0/0' && rule.ipProtocol === '-1'
      );
      
      if (hasUnrestrictedEgress) {
        cdk.Annotations.of(node).addInfo(
          'Security group allows all outbound traffic. Consider applying principle of least privilege.'
        );
      }
    }
  }
}

/**
 * Aspect that enforces IMDSv2 on EC2 instances
 */
export class ImdsAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    if (node instanceof ec2.CfnInstance) {
      const instance = node as ec2.CfnInstance;
      
      if (!instance.metadataOptions || 
          instance.metadataOptions.httpTokens !== 'required') {
        cdk.Annotations.of(node).addError(
          'EC2 instances must enforce IMDSv2 (set HttpTokens to required)'
        );
      }
    }
    
    if (node instanceof ec2.CfnLaunchTemplate) {
      const template = node as ec2.CfnLaunchTemplate;
      
      if (!template.launchTemplateData?.metadataOptions ||
          template.launchTemplateData.metadataOptions.httpTokens !== 'required') {
        cdk.Annotations.of(node).addError(
          'Launch templates must enforce IMDSv2 (set HttpTokens to required)'
        );
      }
    }
  }
}

/**
 * Aspect that prevents public access to resources
 */
export class PublicAccessAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    // Block public S3 buckets
    if (node instanceof s3.CfnBucket) {
      const bucket = node as s3.CfnBucket;
      
      if (!bucket.publicAccessBlockConfiguration) {
        cdk.Annotations.of(node).addError(
          'S3 buckets must have public access block configuration'
        );
      } else {
        const config = bucket.publicAccessBlockConfiguration;
        if (!config.blockPublicAcls || 
            !config.blockPublicPolicy || 
            !config.ignorePublicAcls || 
            !config.restrictPublicBuckets) {
          cdk.Annotations.of(node).addError(
            'S3 buckets must block all public access'
          );
        }
      }
    }
    
    // Block public RDS instances
    if (node instanceof rds.CfnDBInstance) {
      const dbInstance = node as rds.CfnDBInstance;
      
      if (dbInstance.publiclyAccessible === true) {
        cdk.Annotations.of(node).addError(
          'RDS instances must not be publicly accessible'
        );
      }
    }
  }
}

/**
 * Aspect that enforces IAM best practices
 */
export class IamAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    // Check IAM policies for overly permissive actions
    if (node instanceof iam.CfnPolicy || node instanceof iam.CfnRole) {
      const resource = node as any;
      const policyDocument = resource.policyDocument;
      
      if (policyDocument && policyDocument.Statement) {
        policyDocument.Statement.forEach((statement: any, index: number) => {
          // Check for wildcard actions
          if (statement.Action === '*' || 
              (Array.isArray(statement.Action) && statement.Action.includes('*'))) {
            cdk.Annotations.of(node).addWarning(
              `Policy statement ${index} uses wildcard action (*). Consider using specific actions.`
            );
          }
          
          // Check for wildcard resources
          if (statement.Resource === '*' ||
              (Array.isArray(statement.Resource) && statement.Resource.includes('*'))) {
            cdk.Annotations.of(node).addWarning(
              `Policy statement ${index} uses wildcard resource (*). Consider using specific resources.`
            );
          }
          
          // Block Admin access
          if ((statement.Action?.includes('*:*') || statement.Action === '*') &&
              (statement.Resource === '*' || statement.Resource?.includes('*'))) {
            cdk.Annotations.of(node).addError(
              `Policy statement ${index} grants admin access (*:* on *). This is not allowed.`
            );
          }
        });
      }
    }
  }
}

/**
 * Aspect that enforces deletion protection for production
 */
export class DeletionProtectionAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    const stack = cdk.Stack.of(node);
    const environment = cdk.Tags.of(stack).renderedTags['Environment'];
    
    if (environment === 'production') {
      // Enable stack termination protection
      if (node instanceof cdk.Stack) {
        (node as cdk.Stack).terminationProtection = true;
      }
      
      // Retain RDS instances on deletion
      if (node instanceof rds.CfnDBInstance) {
        const db = node as rds.CfnDBInstance;
        if (!db.deletionProtection) {
          db.deletionProtection = true;
          cdk.Annotations.of(node).addInfo(
            'Deletion protection enabled for production RDS instance'
          );
        }
      }
      
      // Retain S3 buckets
      if (node instanceof s3.CfnBucket) {
        node.cfnOptions.deletionPolicy = cdk.CfnDeletionPolicy.RETAIN;
        cdk.Annotations.of(node).addInfo(
          'S3 bucket will be retained on stack deletion (production)'
        );
      }
    }
  }
}

/**
 * Aspect that enforces logging and monitoring
 */
export class LoggingAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    // Enforce VPC Flow Logs
    if (node instanceof ec2.CfnVPC) {
      const vpc = node as ec2.CfnVPC;
      // Check if flow log exists (would need to track this separately)
      cdk.Annotations.of(node).addInfo(
        'Ensure VPC Flow Logs are enabled for network monitoring'
      );
    }
    
    // Enforce S3 access logging
    if (node instanceof s3.CfnBucket) {
      const bucket = node as s3.CfnBucket;
      if (!bucket.loggingConfiguration) {
        cdk.Annotations.of(node).addWarning(
          'S3 bucket should have access logging enabled for audit trail'
        );
      }
    }
    
    // Enforce RDS monitoring
    if (node instanceof rds.CfnDBInstance) {
      const db = node as rds.CfnDBInstance;
      if (!db.enableCloudwatchLogsExports || db.enableCloudwatchLogsExports.length === 0) {
        cdk.Annotations.of(node).addWarning(
          'RDS instance should export logs to CloudWatch'
        );
      }
    }
  }
}
