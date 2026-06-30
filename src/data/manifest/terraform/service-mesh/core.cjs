
// Core App Mesh configuration

export const coreMeshYaml = `# App Mesh service mesh
resource "aws_appmesh_mesh" "d3vonn_mesh" {
  name = "d3vonn-mesh-\${var.environment}"
  
  spec {
    egress_filter {
      type = "ALLOW_ALL"
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = "d3vonn"
    GitRepo     = "d3vonn-infra"
    GitBranch   = "main"
  }

  lifecycle {
    prevent_destroy = false
  }
}`;
