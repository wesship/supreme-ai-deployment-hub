provider "google" {
  credentials = jsondecode(base64decode(var.GCP_CREDENTIALS_JSON))
  project     = var.gcp_project_id
  region      = var.gcp_region
}

resource "google_storage_bucket" "logs" {
  name                        = "devonn-ai-${var.environment}-access-logs"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  labels = {
    environment = var.environment
    purpose     = "access-logs"
    terraform   = "true"
  }
}

resource "google_storage_bucket" "example" {
  name                        = "devonn-ai-${var.environment}-bucket"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  logging {
    log_bucket        = google_storage_bucket.logs.name
    log_object_prefix = "storage-access/"
  }

  labels = {
    environment = var.environment
    terraform   = "true"
  }
}

resource "google_compute_instance" "backend" {
  name         = "devonn-ai-${var.environment}-backend"
  machine_type = var.instance_type
  zone         = var.gcp_zone

  boot_disk {
    initialize_params {
      image = var.gcp_image
    }
  }

  tags = ["devonn-ai"]

  metadata = {
    environment               = var.environment
    block-project-ssh-keys    = "true"
    enable-oslogin            = "true"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  network_interface {
    network = "default"
  }
}

resource "google_compute_instance" "frontend" {
  name         = "devonn-ai-${var.environment}-frontend"
  machine_type = var.instance_type
  zone         = var.gcp_zone

  boot_disk {
    initialize_params {
      image = var.gcp_image
    }
  }

  tags = ["devonn-ai"]

  metadata = {
    environment               = var.environment
    block-project-ssh-keys    = "true"
    enable-oslogin            = "true"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  network_interface {
    network = "default"
  }
}
