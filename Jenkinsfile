pipeline {
    agent any
    
    environment {
        AWS_REGION = 'us-east-1'
        // AWS credentials configured in Jenkins
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
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
        
        stage('CDK Diff') {
            when {
                not { branch 'main' }
            }
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding', 
                     credentialsId: 'aws-credentials']
                ]) {
                    sh 'cdk diff'
                }
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
    
    post {
        success {
            echo 'CDK deployment successful!'
        }
        failure {
            echo 'CDK deployment failed!'
        }
        always {
            cleanWs()
        }
    }
}
