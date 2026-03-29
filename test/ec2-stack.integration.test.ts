import { EC2Client, DescribeInstancesCommand, DescribeVpcsCommand } from '@aws-sdk/client-ec2';

describe('Ec2Stack Integration Tests', () => {
  let ec2Client: EC2Client;
  const stackName = 'Ec2Stack-dev';
  
  beforeAll(() => {
    ec2Client = new EC2Client({ region: 'us-east-1' });
  });
  
  test('VPC exists with correct CIDR', async () => {
    const response = await ec2Client.send(
      new DescribeVpcsCommand({
        Filters: [
          { Name: 'tag:aws:cloudformation:stack-name', Values: [stackName] },
        ],
      })
    );
    
    expect(response.Vpcs).toHaveLength(1);
    expect(response.Vpcs[0].CidrBlock).toBe('10.0.0.0/16');
  }, 30000);
  
  test('EC2 instance is running', async () => {
    const response = await ec2Client.send(
      new DescribeInstancesCommand({
        Filters: [
          { Name: 'tag:aws:cloudformation:stack-name', Values: [stackName] },
          { Name: 'instance-state-name', Values: ['running'] },
        ],
      })
    );
    
    expect(response.Reservations).toHaveLength(1);
    expect(response.Reservations[0].Instances).toHaveLength(1);
    
    const instance = response.Reservations[0].Instances[0];
    expect(instance.InstanceType).toBe('t3.micro');
    expect(instance.State.Name).toBe('running');
  }, 30000);
  
  test('Instance has public IP', async () => {
    const response = await ec2Client.send(
      new DescribeInstancesCommand({
        Filters: [
          { Name: 'tag:aws:cloudformation:stack-name', Values: [stackName] },
        ],
      })
    );
    
    const instance = response.Reservations[0].Instances[0];
    expect(instance.PublicIpAddress).toBeDefined();
    expect(instance.PublicIpAddress).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  }, 30000);
  
  test('Security group allows HTTP and SSH', async () => {
    const response = await ec2Client.send(
      new DescribeInstancesCommand({
        Filters: [
          { Name: 'tag:aws:cloudformation:stack-name', Values: [stackName] },
        ],
      })
    );
    
    const instance = response.Reservations[0].Instances[0];
    const sgId = instance.SecurityGroups[0].GroupId;
    
    // Check security group rules
    const sgResponse = await ec2Client.send(
      new DescribeSecurityGroupsCommand({
        GroupIds: [sgId],
      })
    );
    
    const ingressRules = sgResponse.SecurityGroups[0].IpPermissions;
    const hasHTTP = ingressRules.some(r => r.FromPort === 80 && r.ToPort === 80);
    const hasSSH = ingressRules.some(r => r.FromPort === 22 && r.ToPort === 22);
    
    expect(hasHTTP).toBe(true);
    expect(hasSSH).toBe(true);
  }, 30000);
});
