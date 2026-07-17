provider "aws" {
  region = var.aws_region
}

# ----------------------------------------------------
# AWS S3 Bucket
# ----------------------------------------------------
resource "aws_s3_bucket" "example" {
  bucket = "devonn-ai-${var.environment}-bucket"

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}

resource "aws_s3_bucket_public_access_block" "example" {
  bucket = aws_s3_bucket.example.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "example" {
  bucket = aws_s3_bucket.example.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "example" {
  bucket = aws_s3_bucket.example.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.aws_s3_kms_key_arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_logging" "example" {
  bucket        = aws_s3_bucket.example.id
  target_bucket = var.aws_access_log_bucket_name
  target_prefix = "${aws_s3_bucket.example.id}/"
}

resource "aws_s3_bucket_lifecycle_configuration" "example" {
  bucket = aws_s3_bucket.example.id

  rule {
    id     = "archive-noncurrent-objects"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_s3_bucket_notification" "example" {
  bucket      = aws_s3_bucket.example.id
  eventbridge = true
}

resource "aws_s3_bucket_replication_configuration" "example" {
  depends_on = [aws_s3_bucket_versioning.example]

  bucket = aws_s3_bucket.example.id
  role   = var.aws_s3_replication_role_arn

  rule {
    id     = "cross-region-replication"
    status = "Enabled"

    filter {}

    destination {
      bucket        = var.aws_s3_replica_bucket_arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = var.aws_s3_replica_kms_key_arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }
  }
}

# ----------------------------------------------------
# EC2 Instance (Backend)
# ----------------------------------------------------
resource "aws_instance" "backend" {
  ami                    = var.aws_ami_id
  instance_type          = var.instance_type
  monitoring             = true
  ebs_optimized          = true
  iam_instance_profile   = var.aws_instance_profile_name
  vpc_security_group_ids = var.aws_security_group_ids
  subnet_id              = var.aws_private_subnet_id

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    encrypted  = true
    kms_key_id = var.aws_ebs_kms_key_arn
  }

  tags = {
    Name        = "DevonnAI-${var.environment}-backend"
    Environment = var.environment
  }
}

# ----------------------------------------------------
# EC2 Instance (Frontend)
# ----------------------------------------------------
resource "aws_instance" "frontend" {
  ami                    = var.aws_ami_id
  instance_type          = var.instance_type
  monitoring             = true
  ebs_optimized          = true
  iam_instance_profile   = var.aws_instance_profile_name
  vpc_security_group_ids = var.aws_security_group_ids
  subnet_id              = var.aws_private_subnet_id

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    encrypted  = true
    kms_key_id = var.aws_ebs_kms_key_arn
  }

  tags = {
    Name        = "DevonnAI-${var.environment}-frontend"
    Environment = var.environment
  }
}
