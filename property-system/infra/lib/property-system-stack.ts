/**
 * Property System Infrastructure Stack
 *
 * CDK構成仕様書に基づくAWSリソース定義
 *
 * リソース構成:
 * - Cognito User Pool（メール+パスワード認証）
 * - DynamoDB Properties テーブル（GSI: name-index, staff-index, medium-index）
 * - S3 バケット（物件ファイル保存 + フロントエンドホスティング）
 * - Lambda Functions（8関数）
 * - API Gateway（REST API + Cognito Authorizer）
 * - CloudFront + S3（フロントエンド配信）
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as events from 'aws-cdk-lib/aws-events';
import * as path from 'path';
import * as fs from 'fs';

// =============================================================================
// Props Interface
// =============================================================================
export interface PropertySystemStackProps extends cdk.StackProps {
  /** 環境名（dev / staging / prod） */
  readonly envName: string;
  /** フロントエンドデプロイをスキップするか */
  readonly skipFrontendDeploy?: boolean;
}

// =============================================================================
// Main Stack
// =============================================================================
export class PropertySystemStack extends cdk.Stack {
  // Public resources for cross-stack references
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly propertiesTable: dynamodb.Table;
  public readonly historyTable: dynamodb.Table;
  public readonly userLoginTable: dynamodb.Table;
  public readonly propertyBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: PropertySystemStackProps) {
    super(scope, id, props);

    const { envName, skipFrontendDeploy = false } = props;

    // 共通タグ
    cdk.Tags.of(this).add('Project', 'PropertySystem');
    cdk.Tags.of(this).add('Environment', envName);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // =========================================================================
    // 1. Cognito User Pool（認証）
    // =========================================================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `property-system-users-${envName}`,
      
      // サインアップ設定
      selfSignUpEnabled: true, // ユーザーが自己登録可能
      
      // サインイン設定
      signInAliases: {
        email: true,
        username: false,
      },
      
      // 自動検証
      autoVerify: {
        email: true,
      },
      
      // 標準属性
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      
      // パスワードポリシー
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      
      // アカウントリカバリー
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      // メール設定
      email: cognito.UserPoolEmail.withCognito(),
      
      // 削除保護
      removalPolicy: ['prod', 'suzuichi01'].includes(envName)
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('AppClient', {
      userPoolClientName: `property-app-client-${envName}`,
      
      // 認証フロー
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: false,
      },
      
      // OAuth設定
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
      },
      
      // トークン有効期限
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      
      // セキュリティ設定
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
    });

    // User Groups（admin / internal / external）
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: '管理者グループ - 全権限（物件CRUD、ユーザー管理、削除）',
      precedence: 1,
    });

    new cognito.CfnUserPoolGroup(this, 'InternalGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'internal',
      description: '社内ユーザーグループ - 閲覧・登録・編集（削除不可）',
      precedence: 2,
    });

    new cognito.CfnUserPoolGroup(this, 'ExternalGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'external',
      description: '外部ユーザーグループ - 物件閲覧不可',
      precedence: 3,
    });

    // =========================================================================
    // 2. DynamoDB Properties テーブル
    // =========================================================================
    this.propertiesTable = new dynamodb.Table(this, 'PropertiesTable', {
      tableName: `Properties-${envName}`,
      
      // キー設計
      partitionKey: {
        name: 'propertyId',
        type: dynamodb.AttributeType.STRING,
      },
      
      // 課金モード（オンデマンド）
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      // ポイントインタイムリカバリ
      pointInTimeRecovery: true,
      
      // 削除保護
      removalPolicy: ['prod', 'suzuichi01'].includes(envName)
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI: name-index（大項目 × 名称検索）
    this.propertiesTable.addGlobalSecondaryIndex({
      indexName: 'name-index',
      partitionKey: {
        name: 'typeLarge',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'name',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: staff-index（担当者検索）
    this.propertiesTable.addGlobalSecondaryIndex({
      indexName: 'staff-index',
      partitionKey: {
        name: 'staff',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'name',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: medium-index（中項目検索）
    this.propertiesTable.addGlobalSecondaryIndex({
      indexName: 'medium-index',
      partitionKey: {
        name: 'typeMedium',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'name',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // =========================================================================
    // 2-2. DynamoDB PropertyHistory テーブル（操作履歴）
    // =========================================================================
    this.historyTable = new dynamodb.Table(this, 'PropertyHistoryTable', {
      tableName: `PropertyHistory-${envName}`,

      // キー設計: 物件ごとに時系列で並ぶ（eventId = timestamp#uuid）
      partitionKey: {
        name: 'propertyId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING,
      },

      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,

      // 履歴は監査用途のため、環境を問わず必ず残す
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI: user-index（ユーザー別の操作履歴）
    this.historyTable.addGlobalSecondaryIndex({
      indexName: 'user-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: timeline-index（全体の操作ログを時系列で取得）
    this.historyTable.addGlobalSecondaryIndex({
      indexName: 'timeline-index',
      partitionKey: {
        name: 'gsiPk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // =========================================================================
    // 2-3. DynamoDB UserLogin テーブル（最終ログイン日時）
    //
    // Cognito にはログイン日時を保持する項目が無い（UserLastModifiedDate は
    // アカウント情報の変更日であって、ログインしても更新されない）。
    // PostAuthentication トリガーでサインインのたびにここへ記録する。
    // =========================================================================
    this.userLoginTable = new dynamodb.Table(this, 'UserLoginTable', {
      tableName: `UserLogin-${envName}`,

      // Cognito の Username（sub）を1件1ユーザーで持つ
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },

      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,

      // 利用状況の記録なので環境を問わず残す
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // 3. S3 Bucket（物件ファイル保存）
    // =========================================================================
    this.propertyBucket = new s3.Bucket(this, 'PropertyBucket', {
      bucketName: `property-system-files-${envName}-${this.account}`,
      
      // セキュリティ
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      
      // バージョニング
      versioned: true,
      
      // CORS設定
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'], // 本番環境では CloudFront URL に制限推奨
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      
      // ライフサイクルルール
      lifecycleRules: [
        {
          id: 'intelligent-tiering',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'incomplete-multipart-cleanup',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      
      // 削除保護
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // 4. S3 Bucket（フロントエンドホスティング）
    // =========================================================================
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `property-system-frontend-${envName}-${this.account}`,
      
      // セキュリティ
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      
      // 削除時の動作
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // =========================================================================
    // 5. Lambda Functions
    // =========================================================================
    const lambdasPath = path.join(__dirname, '../../backend/lambdas');

    // 共通環境変数
    const lambdaEnvironment: Record<string, string> = {
      TABLE_NAME: this.propertiesTable.tableName,
      HISTORY_TABLE_NAME: this.historyTable.tableName,
      LOGIN_TABLE_NAME: this.userLoginTable.tableName,
      BUCKET_NAME: this.propertyBucket.bucketName,
      USER_POOL_ID: this.userPool.userPoolId,
      REGION: this.region,
      NODE_OPTIONS: '--enable-source-maps',
    };

    // 共通 Lambda 設定
    const defaultLambdaProps: Partial<lambdaNodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: lambdaEnvironment,
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
    };

    // Lambda 関数を作成するヘルパー
    const createLambda = (
      name: string,
      entryFile: string,
      overrides?: Partial<lambdaNodejs.NodejsFunctionProps>
    ): lambdaNodejs.NodejsFunction => {
      return new lambdaNodejs.NodejsFunction(this, `${name}Function`, {
        ...defaultLambdaProps,
        ...overrides,
        functionName: `${name}-${envName}`,
        entry: path.join(lambdasPath, entryFile),
        handler: 'handler',
      });
    };

    // Lambda Functions
    const getPropertiesLambda = createLambda('getProperties', 'getProperties/index.ts');
    const getPropertyLambda = createLambda('getProperty', 'getProperty/index.ts');
    const createPropertyLambda = createLambda('createProperty', 'createProperty/index.ts');
    const updatePropertyLambda = createLambda('updateProperty', 'updateProperty/index.ts');
    const deletePropertyLambda = createLambda('deleteProperty', 'deleteProperty/index.ts');
    const getUploadUrlLambda = createLambda('getUploadUrl', 'getUploadUrl/index.ts');
    const getFilesLambda = createLambda('getFiles', 'getFiles/index.ts');
    const deleteFileLambda = createLambda('deleteFile', 'deleteFile/index.ts');
    const getHistoryLambda = createLambda('getHistory', 'getHistory/index.ts');

    // bulkUpload（長時間処理のため設定を上書き）
    const bulkUploadLambda = createLambda('bulkUpload', 'bulkUpload/index.ts', {
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // ログイン日時の記録（Cognito PostAuthentication トリガー）
    //
    // 環境変数に USER_POOL_ID を入れないこと。
    // ユーザープールがこの Lambda を参照する（トリガー登録）ため、
    // Lambda 側からユーザープールを参照すると循環参照になりデプロイできない。
    // この Lambda は DynamoDB に書くだけなのでユーザープールの情報は不要。
    const recordLoginLambda = createLambda('recordLogin', 'recordLogin/index.ts', {
      environment: {
        LOGIN_TABLE_NAME: this.userLoginTable.tableName,
        REGION: this.region,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });
    this.userLoginTable.grantWriteData(recordLoginLambda);
    this.userPool.addTrigger(
      cognito.UserPoolOperation.POST_AUTHENTICATION,
      recordLoginLambda
    );

    // ユーザー管理 Lambda Functions
    const listUsersLambda = createLambda('listUsers', 'listUsers/index.ts');
    const inviteUserLambda = createLambda('inviteUser', 'inviteUser/index.ts');
    const updateUserGroupLambda = createLambda('updateUserGroup', 'updateUserGroup/index.ts');
    const deleteUserLambda = createLambda('deleteUser', 'deleteUser/index.ts');

    // ユーザー管理Lambda に Cognito 権限を付与
    const cognitoUserLambdas = [listUsersLambda, inviteUserLambda, updateUserGroupLambda, deleteUserLambda];
    cognitoUserLambdas.forEach((fn) => {
      fn.addEnvironment('USER_POOL_ID', this.userPool.userPoolId);
      this.userPool.grant(fn, 
        'cognito-idp:ListUsers',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:AdminListGroupsForUser'
      );
    });

    // Lambda 関数一覧
    const allLambdas = [
      getPropertiesLambda,
      getPropertyLambda,
      createPropertyLambda,
      updatePropertyLambda,
      deletePropertyLambda,
      getUploadUrlLambda,
      bulkUploadLambda,
      getFilesLambda,
      deleteFileLambda,
    ];

    // 権限付与（メインテーブル + S3）
    allLambdas.forEach((fn) => {
      this.propertiesTable.grantReadWriteData(fn);
      this.propertyBucket.grantReadWrite(fn);
      // 操作履歴の書き込み
      this.historyTable.grantWriteData(fn);
    });

    // 操作ログ参照 Lambda（読み取りのみ）
    this.historyTable.grantReadData(getHistoryLambda);

    // ユーザー一覧に最終ログイン日時を出すための読み取り権限
    this.userLoginTable.grantReadData(listUsersLambda);



    // S3 トリガー（一括登録用 CSV アップロード）
    this.propertyBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(bulkUploadLambda),
      { prefix: 'uploads/bulk/', suffix: '.csv' }
    );

    // =========================================================================
    // 6. API Gateway（REST API）
    // =========================================================================
    this.api = new apigateway.RestApi(this, 'PropertyApi', {
      restApiName: `property-system-api-${envName}`,
      description: '物件管理システム REST API',
      
      // デプロイ設定
      deployOptions: {
        stageName: envName,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: envName !== 'prod',
        metricsEnabled: true,
      },
      
      // CORS設定
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Tenant-Host',
          'X-Forwarded-Host',
        ],
      },
      
      // バイナリメディアタイプ
      binaryMediaTypes: ['multipart/form-data'],
    });

    // Gateway Responses for CORS on 4XX/5XX errors
    this.api.addGatewayResponse('GatewayResponse4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Tenant-Host,X-Forwarded-Host'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    this.api.addGatewayResponse('GatewayResponse5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Tenant-Host,X-Forwarded-Host'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [this.userPool],
      authorizerName: `property-authorizer-${envName}`,
      identitySource: 'method.request.header.Authorization',
    });

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // API Routes
    // /properties
    const propertiesResource = this.api.root.addResource('properties');
    propertiesResource.addMethod('GET', new apigateway.LambdaIntegration(getPropertiesLambda), authOptions);
    propertiesResource.addMethod('POST', new apigateway.LambdaIntegration(createPropertyLambda), authOptions);

    // /properties/bulk
    const bulkResource = propertiesResource.addResource('bulk');
    bulkResource.addMethod('POST', new apigateway.LambdaIntegration(bulkUploadLambda), authOptions);

    // /properties/{propertyId}
    const propertyResource = propertiesResource.addResource('{propertyId}');
    propertyResource.addMethod('GET', new apigateway.LambdaIntegration(getPropertyLambda), authOptions);
    propertyResource.addMethod('PUT', new apigateway.LambdaIntegration(updatePropertyLambda), authOptions);
    propertyResource.addMethod('DELETE', new apigateway.LambdaIntegration(deletePropertyLambda), authOptions);

    // /properties/{propertyId}/files
    const filesResource = propertyResource.addResource('files');
    filesResource.addMethod('GET', new apigateway.LambdaIntegration(getFilesLambda), authOptions);
    filesResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteFileLambda), authOptions);

    // /upload-url
    const uploadUrlResource = this.api.root.addResource('upload-url');
    uploadUrlResource.addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlLambda), authOptions);

    // /history（操作ログ - 管理者専用）
    const historyResource = this.api.root.addResource('history');
    historyResource.addMethod('GET', new apigateway.LambdaIntegration(getHistoryLambda), authOptions);

    // /users（ユーザー管理 - 管理者専用）
    const usersResource = this.api.root.addResource('users');
    usersResource.addMethod('GET', new apigateway.LambdaIntegration(listUsersLambda), authOptions);
    
    // /users/invite
    const inviteResource = usersResource.addResource('invite');
    inviteResource.addMethod('POST', new apigateway.LambdaIntegration(inviteUserLambda), authOptions);

    // /users/{userId}
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteUserLambda), authOptions);

    // /users/{userId}/group
    const userGroupResource = userResource.addResource('group');
    userGroupResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserGroupLambda), authOptions);

    // =========================================================================
    // 7. CloudFront Distribution（フロントエンド配信）
    // =========================================================================
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for property-system-${envName}`,
    });

    this.frontendBucket.grantRead(originAccessIdentity);

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Property System Frontend - ${envName}`,
      
      // デフォルトビヘイビア
      defaultBehavior: {
        origin: new origins.S3Origin(this.frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
      },
      
      // デフォルトルートオブジェクト
      defaultRootObject: 'index.html',
      
      // エラーレスポンス（SPA対応）
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      
      // 価格クラス
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      
      // HTTP/2 有効化
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      
      // 最小 TLS バージョン
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // =========================================================================
    // 8. Frontend Deployment（条件付き）
    // =========================================================================
    const frontendBuildPath = path.join(__dirname, '../../frontend/out');
    const frontendExists = fs.existsSync(frontendBuildPath);

    if (!skipFrontendDeploy && frontendExists) {
      new s3deploy.BucketDeployment(this, 'FrontendDeployment', {
        sources: [s3deploy.Source.asset(frontendBuildPath)],
        destinationBucket: this.frontendBucket,
        distribution: this.distribution,
        distributionPaths: ['/*'],
        memoryLimit: 512,
        prune: true,
      });
    }

    // =========================================================================
    // 9. AWS Backup（DynamoDB 自動バックアップ）
    // =========================================================================
    const backupVault = new backup.BackupVault(this, 'BackupVault', {
      backupVaultName: `property-system-backup-${envName}`,
      removalPolicy: ['prod', 'suzuichi01'].includes(envName)
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
      backupPlanName: `property-system-plan-${envName}`,
      backupVault,
    });

    backupPlan.addRule(new backup.BackupPlanRule({
      ruleName: 'DailyBackup',
      scheduleExpression: events.Schedule.cron({ hour: '18', minute: '0' }),
      deleteAfter: cdk.Duration.days(30),
      startWindow: cdk.Duration.hours(1),
      completionWindow: cdk.Duration.hours(2),
    }));

    backupPlan.addSelection('DynamoDBSelection', {
      resources: [
        backup.BackupResource.fromDynamoDbTable(this.propertiesTable),
      ],
    });

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${envName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${envName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway Endpoint URL',
      exportName: `${envName}-ApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'PropertyBucketName', {
      value: this.propertyBucket.bucketName,
      description: 'Property Files S3 Bucket Name',
      exportName: `${envName}-PropertyBucketName`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'Frontend Hosting S3 Bucket Name',
      exportName: `${envName}-FrontendBucketName`,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: `${envName}-CloudFrontUrl`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${envName}-CloudFrontDistributionId`,
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: this.propertiesTable.tableName,
      description: 'DynamoDB Table Name',
      exportName: `${envName}-DynamoDBTableName`,
    });
  }
}
