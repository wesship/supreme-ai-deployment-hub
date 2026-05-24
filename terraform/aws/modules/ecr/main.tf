variable "name_prefix" {
  description = "Name prefix used for ECR repositories."
  type        = string
}

variable "tags" {
  description = "Tags applied to ECR repositories."
  type        = map(string)
  default     = {}
}

resource "aws_ecr_repository" "backend" {
  name = "${var.name_prefix}-backend"
  tags = var.tags
}

resource "aws_ecr_repository" "frontend" {
  name = "${var.name_prefix}-frontend"
  tags = var.tags
}

output "repository_urls" {
  value = {
    backend  = aws_ecr_repository.backend.repository_url
    frontend = aws_ecr_repository.frontend.repository_url
  }
}
