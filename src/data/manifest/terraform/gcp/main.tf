provider "google" {
  credentials = jsondecode(base64decode(var.GCP_CREDENTIALS_JSON))
  project     = var.gcp_project_id
  region      = var.gcp_region
}

# ----------------------------------------------------
# Google Cloud Storage Bucket
# ----------------------------------------------------
resource "google_storage_bucket" "example" {
  name                        = "devonn-ai-${var.environment}-bucket"
  location                    = var.gcp_region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  logging {
    log_bucket        = var.gcp_access_log_bucket_name
    log_object_prefix = "${var.environment}/storage/"
  }

  labels = {
    environment = var.environment
    terraform   = "true"
  }
}

# ----------------------------------------------------
# Google Compute Engine Instance (Backend)
# ----------------------------------------------------
resource "google_compute_instance" "backend" {
  name         = "devonn-ai-${var.environment}-backend"
  machine_type = var.instance_type
  zone         = var.gcp_zone

  boot_disk {
    kms_key_self_link = var.gcp_disk_kms_key_self_link

    initialize_params {
      image = var.gcp_image
    }
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  tags = ["devonn-ai"]

  metadata = {
    environment                  = var.environment
    block-project-ssh-keys       = "true"
    enable-oslogin               = "true"
    disable-legacy-endpoints     = "true"
  }

  network_interface {
    network    = var.gcp_network_self_link
    subnetwork = var.gcp_private_subnetwork_self_link
  }

  service_account {
    email  = var.gcp_service_account_email
    scopes = ["cloud-platform"]
  }
}

# ----------------------------------------------------
# Google Compute Engine Instance (Frontend)
# ----------------------------------------------------
resource "google_compute_instance" "frontend" {
  name         = "devonn-ai-${var.environment}-frontend"
  machine_type = var.instance_type
  zone         = var.gcp_zone

  boot_disk {
    kms_key_self_link = var.gcp_disk_kms_key_self_link

    initialize_params {
      image = var.gcp_image
    }
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  tags = ["devonn-ai"]

  metadata = {
    environment                  = var.environment
    block-project-ssh-keys       = "true"
    enable-oslogin               = "true"
    disable-legacy-endpoints     = "true"
  }

  network_interface {
    network    = var.gcp_network_self_link
    subnetwork = var.gcp_private_subnetwork_self_link
  }

  service_account {
    email  = var.gcp_service_account_email
    scopes = ["cloud-platform"]
  }
}
