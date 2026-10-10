
// Virtual services configuration

export const servicesYaml = `# Virtual services
resource "aws_appmesh_virtual_service" "api_service" {
  name      = "api.devonn.local"
  mesh_name = aws_appmesh_mesh.devonn_mesh.name
  
  spec {
    provider {
      virtual_node {
        virtual_node_name = aws_appmesh_virtual_node.api_node.name
      }
    }
  }
}

resource "aws_appmesh_virtual_service" "database_service" {
  name      = "database.devonn.local"
  mesh_name = aws_appmesh_mesh.devonn_mesh.name
  
  spec {
    provider {
      virtual_node {
        virtual_node_name = aws_appmesh_virtual_node.database_node.name
      }
    }
  }
}

resource "aws_appmesh_virtual_service" "worker_service" {
  name      = "worker.devonn.local"
  mesh_name = aws_appmesh_mesh.devonn_mesh.name
  
  spec {
    provider {
      virtual_node {
        virtual_node_name = aws_appmesh_virtual_node.worker_node.name
      }
    }
  }
}`;
