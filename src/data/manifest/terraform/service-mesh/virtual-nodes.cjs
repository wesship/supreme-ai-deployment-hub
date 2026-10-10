
// Virtual nodes for microservices

export const nodesYaml = `# Virtual nodes for microservices
resource "aws_appmesh_virtual_node" "api_node" {
  name      = "api-node"
  mesh_name = aws_appmesh_mesh.devonn_mesh.name
  
  spec {
    listener {
      port_mapping {
        port     = 8000
        protocol = "http"
      }
      
      health_check {
        protocol            = "http"
        path                = "/api/health"
        healthy_threshold   = 2
        unhealthy_threshold = 3
        timeout_millis      = 3000
        interval_millis     = 10000
      }
    }
    
    service_discovery {
      dns {
        hostname = "api-canary.devonn.local"
      }
    }
    
    backend {
      virtual_service {
        virtual_service_name = "database.devonn.local"
      }
    }
    
    logging {
      access_log {
        file {
          path = "/dev/stdout"
        }
      }
    }
  }
}

resource "aws_appmesh_virtual_node" "database_node" {
  name      = "database-node"
  mesh_name = aws_appmesh_mesh.devonn_mesh.name
  
  spec {
    listener {
      port_mapping {
        port     = 5432
        protocol = "tcp"
      }
    }
    
    service_discovery {
      dns {
        hostname = "database.devonn.local"
      }
    }
  }
}

resource "aws_appmesh_virtual_node" "worker_node" {
  name      = "worker-node"
  mesh_name = aws_appmesh_mesh.devonn_mesh.name
  
  spec {
    listener {
      port_mapping {
        port     = 8080
        protocol = "http"
      }
    }
    
    service_discovery {
      dns {
        hostname = "worker.devonn.local"
      }
    }
    
    backend {
      virtual_service {
        virtual_service_name = "database.devonn.local"
      }
    }
    
    backend {
      virtual_service {
        virtual_service_name = "api.devonn.local"
      }
    }
  }
}`;
