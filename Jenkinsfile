pipeline {
    agent {label "Build-Slaves-L"}
        docker {
            image 'node:18-alpine'
            args '-u root:root'
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
