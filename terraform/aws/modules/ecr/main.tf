resource "aws_ecr_repository" "backend" {
  name = "${var.name_prefix}-backend"
}

resource "aws_ecr_repository" "frontend" {
  name = "${var.name_prefix}-frontend"
}

output "repository_urls" {
  value = {
    backend  = aws_ecr_repository.backend.repository_url
    frontend = aws_ecr_repository.frontend.repository_url
  }
}
