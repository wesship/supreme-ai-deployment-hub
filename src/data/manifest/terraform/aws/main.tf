provider "aws" {
  region = var.aws_region
}

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

resource "aws_s3_bucket_server_side_encryption_configuration" "example" {
  bucket = aws_s3_bucket.example.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "example" {
  bucket = aws_s3_bucket.example.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_instance" "backend" {
  ami           = var.aws_ami_id
  instance_type = var.instance_type
  monitoring    = true
  ebs_optimized = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    encrypted = true
  }

  tags = {
    Name        = "DevonnAI-${var.environment}-backend"
    Environment = var.environment
  }
}

resource "aws_instance" "frontend" {
  ami           = var.aws_ami_id
  instance_type = var.instance_type
  monitoring    = true
  ebs_optimized = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    encrypted = true
  }

  tags = {
    Name        = "DevonnAI-${var.environment}-frontend"
    Environment = var.environment
  }
}
