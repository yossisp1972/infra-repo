pipeline {
    agent {
        label 'Build-Slaves-L'
    }
    
    environment {
        AWS_REGION = 'us-east-1'
    }
    
    stages {
        stage('Pull Node Image') {
            steps {
                sh 'docker pull docker.io/library/node:18-alpine'
            }
        }
        
        stage('Install CDK & Deploy') {
            steps {
                script {
                    docker.image('node:18-alpine').inside('-u root:root') {
                        sh '''
                            node --version
                            npm --version
                            npm install -g aws-cdk
                            npm ci
                            cdk synth
                        '''
                        
                        if (env.BRANCH_NAME == 'main') {
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
        }
    }
}
