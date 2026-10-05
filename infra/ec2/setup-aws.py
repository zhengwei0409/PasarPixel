#!/usr/bin/env python3
"""One-time AWS setup. Run on your Mac with an authenticated AWS CLI.

Creates GitHub OIDC deployment permissions and attaches an SSM instance role.
Does not create instances, change inbound rules, or deploy containers.
"""
import argparse
import json
import subprocess
import time


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--instance-id', required=True)
parser.add_argument('--region', default='ap-southeast-1')
parser.add_argument('--repository', default='zhengwei0409/PasarPixel')
args = parser.parse_args()


def aws(*parts, optional=False):
    result = subprocess.run(
        ['aws', *parts, '--region', args.region, '--output', 'json', '--no-cli-pager'],
        capture_output=True, text=True,
    )
    if result.returncode:
        if optional and 'NoSuchEntity' in result.stderr:
            return None
        raise SystemExit(result.stderr)
    return json.loads(result.stdout) if result.stdout.strip() else {}


account = aws('sts', 'get-caller-identity')['Account']
instance = aws('ec2', 'describe-instances', '--instance-ids', args.instance_id)['Reservations'][0]['Instances'][0]
profile_name = 'pasarpixel-ec2-ssm'
profile_arn = f'arn:aws:iam::{account}:instance-profile/{profile_name}'
existing_profile = instance.get('IamInstanceProfile', {}).get('Arn')
if existing_profile and existing_profile != profile_arn:
    raise SystemExit('Instance already has another IAM profile. Add SSM permissions to that role instead; this script will not replace it.')


def ensure_role(name, trust):
    if aws('iam', 'get-role', '--role-name', name, optional=True) is None:
        aws('iam', 'create-role', '--role-name', name,
            '--assume-role-policy-document', json.dumps(trust))
    else:
        aws('iam', 'update-assume-role-policy', '--role-name', name,
            '--policy-document', json.dumps(trust))


ensure_role(profile_name, {
    'Version': '2012-10-17', 'Statement': [{
        'Effect': 'Allow', 'Principal': {'Service': 'ec2.amazonaws.com'},
        'Action': 'sts:AssumeRole',
    }],
})
aws('iam', 'attach-role-policy', '--role-name', profile_name,
    '--policy-arn', 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore')
profile = aws('iam', 'get-instance-profile', '--instance-profile-name', profile_name, optional=True)
if profile is None:
    aws('iam', 'create-instance-profile', '--instance-profile-name', profile_name)
    profile = {'InstanceProfile': {'Roles': []}}
if not profile['InstanceProfile']['Roles']:
    aws('iam', 'add-role-to-instance-profile', '--instance-profile-name', profile_name,
        '--role-name', profile_name)
elif [r['RoleName'] for r in profile['InstanceProfile']['Roles']] != [profile_name]:
    raise SystemExit('Existing profile contains an unexpected role; inspect it before continuing.')
if not existing_profile:
    for attempt in range(12):
        result = subprocess.run([
            'aws', 'ec2', 'associate-iam-instance-profile', '--instance-id', args.instance_id,
            '--iam-instance-profile', json.dumps({'Name': profile_name}),
            '--region', args.region, '--no-cli-pager',
        ], capture_output=True, text=True)
        if result.returncode == 0:
            break
        if 'Invalid IAM Instance Profile' not in result.stderr:
            raise SystemExit(result.stderr)
        time.sleep(5)
    else:
        raise SystemExit('IAM profile has not propagated yet; run this script again shortly.')

provider_arn = f'arn:aws:iam::{account}:oidc-provider/token.actions.githubusercontent.com'
provider = aws('iam', 'get-open-id-connect-provider',
    '--open-id-connect-provider-arn', provider_arn, optional=True)
if provider is None:
    aws('iam', 'create-open-id-connect-provider',
        '--url', 'https://token.actions.githubusercontent.com', '--client-id-list', 'sts.amazonaws.com')
elif 'sts.amazonaws.com' not in provider['ClientIDList']:
    raise SystemExit('Existing GitHub OIDC provider lacks the sts.amazonaws.com audience; inspect it before continuing.')

deploy_role = 'pasarpixel-github-deploy'
ensure_role(deploy_role, {
    'Version': '2012-10-17', 'Statement': [{
        'Effect': 'Allow', 'Principal': {'Federated': provider_arn},
        'Action': 'sts:AssumeRoleWithWebIdentity',
        'Condition': {'StringEquals': {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': f'repo:{args.repository}:ref:refs/heads/main',
        }},
    }],
})
aws('iam', 'put-role-policy', '--role-name', deploy_role, '--policy-name', 'DeployOnlyPasarPixel',
    '--policy-document', json.dumps({
        'Version': '2012-10-17', 'Statement': [
            {'Effect': 'Allow', 'Action': 'ssm:SendCommand', 'Resource': [
                f'arn:aws:ec2:{args.region}:{account}:instance/{args.instance_id}',
                f'arn:aws:ssm:{args.region}::document/AWS-RunShellScript',
            ]},
            {'Effect': 'Allow', 'Action': 'ssm:GetCommandInvocation', 'Resource': '*'},
        ],
    }))
print('Set these GitHub repository Actions VARIABLES (not secrets):')
print(f'EC2_INSTANCE_ID={args.instance_id}')
print(f'AWS_DEPLOY_ROLE_ARN=arn:aws:iam::{account}:role/{deploy_role}')
print('No AWS access key or SSH private key is required in GitHub.')
