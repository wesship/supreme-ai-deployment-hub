
// Core App Mesh configuration

export const coreMeshYaml = `# App Mesh service mesh
resource "aws_appmesh_mesh" "devonn_mesh" {
  name = "devonn-mesh-\${var.environment}"
  
  spec {
    egress_filter {
      type = "ALLOW_ALL"
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = "devonn"
    GitRepo     = "devonn-infra"
    GitBranch   = "main"
  }

  lifecycle {
    prevent_destroy = false
  }
}`;
