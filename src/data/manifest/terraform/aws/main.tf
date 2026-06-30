provider "aws" {
  region = var.aws_region
}

# ----------------------------------------------------
# AWS S3 Bucket
# ----------------------------------------------------
resource "aws_s3_bucket" "example" {
  bucket = "d3vonn-ai-${var.environment}-bucket"
  acl    = "private"

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}

# ----------------------------------------------------
# EC2 Instance (Backend)
# ----------------------------------------------------
resource "aws_instance" "backend" {
  ami           = var.aws_ami_id
  instance_type = var.instance_type

  tags = {
    Name        = "DevonnAI-${var.environment}-backend"
    Environment = var.environment
  }
}

# ----------------------------------------------------
# EC2 Instance (Frontend)
# ----------------------------------------------------
resource "aws_instance" "frontend" {
  ami           = var.aws_ami_id
  instance_type = var.instance_type

  tags = {
    Name        = "DevonnAI-${var.environment}-frontend"
    Environment = var.environment
  }
}
