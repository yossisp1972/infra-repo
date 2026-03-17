pipeline {
    agent {
        docker {
            image 'docker.io/node:18-alpine'  // ← Explicit Docker Hub path
            args '-u root:root'
            label 'Build-Slaves-L'
            registryUrl ''  // ← Use public Docker Hub, not Artifactory
            registryCredentialsId ''  // ← No credentials needed
        }
    }
    
    environment {
        AWS_REGION = 'us-east-1'
        HOME = '.'
    }
    
    stages {
        stage('Install CDK') {
            steps {
                sh '''
                    node --version
                    npm --version
                    npm install -g aws-cdk
                    npm ci
                '''
            }
        }
        
        stage('CDK Synth') {
            steps {
                sh 'cdk synth'
            }
        }
        
        stage('CDK Deploy') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding', 
                     credentialsId: 'aws-credentials']
                ]) {
                    sh 'cdk deploy --all --require-approval never'
                }
            }
        }
    }
}
