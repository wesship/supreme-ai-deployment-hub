output "storage_bucket_name" {
  value       = google_storage_bucket.example.name
  description = "The name of the created Google Cloud Storage bucket"
}

output "backend_instance_public_ip" {
  value       = google_compute_instance.backend.network_interface[0].access_config[0].nat_ip
  description = "The public IP of the Backend Google Compute Engine instance"
}

output "frontend_instance_public_ip" {
  value       = google_compute_instance.frontend.network_interface[0].access_config[0].nat_ip
  description = "The public IP of the Frontend Google Compute Engine instance"
}
