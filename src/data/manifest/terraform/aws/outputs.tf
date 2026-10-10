output "s3_bucket_name" {
  value       = aws_s3_bucket.example.bucket
  description = "The name of the created S3 bucket"
}

output "backend_instance_public_ip" {
  value       = aws_instance.backend.public_ip
  description = "The public IP of the Backend EC2 instance"
}

output "frontend_instance_public_ip" {
  value       = aws_instance.frontend.public_ip
  description = "The public IP of the Frontend EC2 instance"
}
