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
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
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
