pipeline {
    agent {
        label 'Build-Slaves-L'
    }
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'staging', 'production'],
            description: 'Target environment for deployment'
        )
        booleanParam(
            name: 'REQUIRE_APPROVAL',
            defaultValue: true,
            description: 'Require manual approval before deployment'
        )
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
                        sh """
                            node --version
                            npm --version
                            npm install -g aws-cdk
                            npm install
                            npm run build
                            echo "Synthesizing for environment: ${params.ENVIRONMENT}"
                            cdk synth --context environment=${params.ENVIRONMENT}
                        """
                    }
                }
            }
        }
        
        stage('Show Diff') {
            steps {
                script {
                    docker.image('node:18-alpine').inside('-u root:root') {
                        withCredentials([
                            [$class: 'AmazonWebServicesCredentialsBinding', 
                             credentialsId: 'aws-credentials']
                        ]) {
                            sh """
                                npm install -g aws-cdk
                                npm install
                                npm run build
                                echo "=== Changes for ${params.ENVIRONMENT} environment ==="
                                cdk diff --context environment=${params.ENVIRONMENT} || true
                            """
                        }
                    }
                }
            }
        }
        
        stage('Approve Deployment') {
            when {
                expression { params.REQUIRE_APPROVAL == true }
            }
            steps {
                script {
                    def message = """
                    Deploy to ${params.ENVIRONMENT}?
                    
                    Review the diff above before approving.
                    """
                    input message: message,
                          ok: "Deploy to ${params.ENVIRONMENT}"
                }
            }
        }
        
        stage('Bootstrap CDK') {
            steps {
                script {
                    docker.image('node:18-alpine').inside('-u root:root') {
                        withCredentials([
                            [$class: 'AmazonWebServicesCredentialsBinding', 
                             credentialsId: 'aws-credentials']
                        ]) {
                            sh '''
                                npm install -g aws-cdk
                                cdk bootstrap
                            '''
                        }
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
                            sh """
                                npm install -g aws-cdk
                                npm install
                                npm run build
                                echo "Deploying to ${params.ENVIRONMENT} environment..."
                                cdk deploy \\
                                    --context environment=${params.ENVIRONMENT} \\
                                    --require-approval never \\
                                    --verbose
                            """
                        }
                    }
                }
            }
        }
    }
    
    post {
        success {
            echo "Successfully deployed to ${params.ENVIRONMENT} environment!"
        }
        failure {
            echo "Deployment to ${params.ENVIRONMENT} failed!"
        }
    }
}
