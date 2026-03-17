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
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-credentials') {
                        docker.image('node:18-alpine').pull()
                    }
                }
            }
        }
        
        stage('Build & Synth') {
            steps {
                script {
                    docker.image('node:18-alpine').inside('-u root:root') {
                        sh '''
                            node --version
                            npm --version
                            npm install -g aws-cdk
                            npm install
                            npm run build
                            cdk synth
                        '''
                    }
                }
            }
        }
        
        stage('Deploy to AWS') {
            steps {
                script {
                    docker.image('node:18-alpine').inside('-u root:root') {
                        withCredentials([
                            [$class: 'AmazonWebServicesCredentialsBinding', 
                             credentialsId: 'aws-credentials']
                        ]) {
                            sh '''
                                npm run build
                                cdk deploy --all --require-approval never
                            '''
                        }
                    }
                }
            }
        }
    }
}
