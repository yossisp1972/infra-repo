# AWS EC2 Infrastructure with CDK

This project uses AWS CDK to deploy an EC2 instance with VPC and security groups.

## What Gets Deployed

- **VPC**: 2 Availability Zones with public and private subnets
- **EC2 Instance**: t3.micro Amazon Linux 2023
- **Security Group**: Allows SSH (port 22) and HTTP (port 80)
- **Public IP**: Instance gets a public IP for direct access

## Infrastructure Details

**File Structure:**
- `bin/app.ts` - CDK app entry point
- `lib/ec2-stack.ts` - Infrastructure definition (VPC, EC2, Security Groups)
- `Jenkinsfile` - CI/CD pipeline

**Resources Created:**
- 1 VPC with CIDR 10.0.0.0/16
- 2 Public subnets
- 2 Private subnets with NAT Gateway
- 1 EC2 t3.micro instance
- Security group with SSH and HTTP access

## Prerequisites

Before deploying, create an EC2 key pair in AWS:
1. AWS Console → EC2 → Key Pairs → Create key pair
2. Name it (e.g., `my-key-pair`)
3. Update `lib/ec2-stack.ts` line 57 with your key pair name

## Manual Deployment (Local)

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Bootstrap CDK (first time only)
cdk bootstrap

# Preview changes
cdk diff

# Deploy
cdk deploy

# Cleanup
cdk destroy
```

## Automated Deployment (Jenkins)

Push to `main` branch to trigger automatic deployment via Jenkins pipeline.

**Pipeline stages:**
1. Checkout code from GitHub
2. Pull Node.js Docker image
3. Install CDK and dependencies
4. Synthesize CloudFormation
5. Deploy to AWS (main branch only)

## Outputs

After deployment, you'll see:
- **InstanceId**: EC2 instance ID
- **InstancePublicIp**: Public IP to SSH into
- **VpcId**: VPC ID

## SSH Access

```bash
ssh -i /path/to/your-key.pem ec2-user@<InstancePublicIp>
```

## Security Notes

⚠️ **PRODUCTION WARNING**: The security group allows SSH from anywhere (0.0.0.0/0). For production, restrict to your IP:

```typescript
securityGroup.addIngressRule(
  ec2.Peer.ipv4('YOUR.IP.ADDRESS/32'),
  ec2.Port.tcp(22),
  'Allow SSH from my IP only'
);
```

