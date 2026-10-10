terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.45"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "terraform_backend" {
  description             = "KMS key for Terraform state and lock data"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableAccountAdministration"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.bucket_name}-kms"
    Purpose     = "terraform-backend-encryption"
    ManagedBy   = "terraform"
    DevonnStack = "supreme-ai-deployment-hub"
  })
}

resource "aws_kms_alias" "terraform_backend" {
  name          = "alias/${var.bucket_name}-terraform-backend"
  target_key_id = aws_kms_key.terraform_backend.key_id
}

resource "aws_s3_bucket" "tf_state" {
  #checkov:skip=CKV2_AWS_62:Terraform state changes are audited through version history and CI; bucket event delivery requires a separately operated destination.
  #checkov:skip=CKV_AWS_18:This bootstrap bucket cannot safely log to itself; organization-level CloudTrail data events are the required access-audit control.
  #checkov:skip=CKV_AWS_144:Cross-region replication is intentionally deferred until a separately administered disaster-recovery account and destination key exist.
  bucket = var.bucket_name

  tags = merge(var.tags, {
    Name        = var.bucket_name
    Purpose     = "terraform-state"
    ManagedBy   = "terraform"
    DevonnStack = "supreme-ai-deployment-hub"
  })
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  rule {
    id     = "retain-noncurrent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.tf_state]
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.terraform_backend.arn
      sse_algorithm     = "aws:kms"
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_lock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.terraform_backend.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name        = var.lock_table_name
    Purpose     = "terraform-locks"
    ManagedBy   = "terraform"
    DevonnStack = "supreme-ai-deployment-hub"
  })
}

output "state_bucket_name" {
  value = aws_s3_bucket.tf_state.bucket
}

output "lock_table_name" {
  value = aws_dynamodb_table.tf_lock.name
}
