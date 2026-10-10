variable "name_prefix" {
  description = "Name prefix used for network resources."
  type        = string
}

variable "cidr_block" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "az_count" {
  description = "Number of availability zones to prepare for."
  type        = number
  default     = 2
}

variable "tags" {
  description = "Tags applied to network resources."
  type        = map(string)
  default     = {}
}

resource "aws_vpc" "this" {
  #checkov:skip=CKV2_AWS_11:VPC flow logs require a separately managed centralized log destination and service role; this exception must be removed when that logging stack is provisioned.
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  ingress = []
  egress  = []

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-default-deny"
  })
}

output "vpc_id" {
  value = aws_vpc.this.id
}

output "private_subnet_ids" {
  value = []
}

output "public_subnet_ids" {
  value = []
}

output "az_count" {
  value = var.az_count
}
