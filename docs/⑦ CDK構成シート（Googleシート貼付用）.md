# **⑦ CDK構成シート（Googleシート貼付用）**

# **\===============================================**

| リソース名 | AWSサービス | 役割 |
| ----- | ----- | ----- |
| PropertySystemStack | CDK Stack | 基本構成 |
| FrontendHostingStack | CDK Stack | CloudFront \+ S3 |
| PropertyBucket | S3 | ファイル保存 |
| FrontendBucket | S3 | Reactホスティング |
| PropertyTable | DynamoDB | 物件DB |
| UserPool | Cognito | 認証 |
| Lambda Functions | Lambda | API処理 |
| PropertyApi | API Gateway | REST API |
| CloudFrontCDN | CloudFront | フロント配信 |

