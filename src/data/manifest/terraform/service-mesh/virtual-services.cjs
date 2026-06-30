
// Virtual services configuration

export const servicesYaml = `# Virtual services
resource "aws_appmesh_virtual_service" "api_service" {
  name      = "api.d3vonn.local"
  mesh_name = aws_appmesh_mesh.d3vonn_mesh.name
  
  spec {
    provider {
      virtual_node {
        virtual_node_name = aws_appmesh_virtual_node.api_node.name
      }
    }
  }
}

resource "aws_appmesh_virtual_service" "database_service" {
  name      = "database.d3vonn.local"
  mesh_name = aws_appmesh_mesh.d3vonn_mesh.name
  
  spec {
    provider {
      virtual_node {
        virtual_node_name = aws_appmesh_virtual_node.database_node.name
      }
    }
  }
}

resource "aws_appmesh_virtual_service" "worker_service" {
  name      = "worker.d3vonn.local"
  mesh_name = aws_appmesh_mesh.d3vonn_mesh.name
  
  spec {
    provider {
      virtual_node {
        virtual_node_name = aws_appmesh_virtual_node.worker_node.name
      }
    }
  }
}`;
