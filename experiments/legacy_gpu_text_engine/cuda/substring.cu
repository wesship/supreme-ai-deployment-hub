// Optional experimental legacy CUDA substring matcher. Not built in CI.
// Input is ASCII bytes; case-sensitive exact matching only.
// A one-byte-per-position result vector is intentionally simple for parity testing.
#include <cuda_runtime.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <string>

#define CHECK(call) do { cudaError_t e=(call); if(e!=cudaSuccess) { fprintf(stderr,"CUDA: %s\n",cudaGetErrorString(e)); return 2; } } while(0)

__global__ void match_kernel(const unsigned char* text, int n,
                             const unsigned char* query, int m,
                             unsigned char* out) {
  int i = blockIdx.x * blockDim.x + threadIdx.x;
  if (i >= n) return;
  if (i + m > n) { out[i] = 0; return; }
  unsigned char ok = 1;
  for (int j=0; j<m; ++j) if (text[i+j] != query[j]) { ok=0; break; }
  out[i] = ok;
}

int main(int argc, char** argv) {
  if (argc != 3) { fprintf(stderr, "usage: substring TEXT QUERY\n"); return 64; }
  std::string text(argv[1]), query(argv[2]);
  if (query.empty() || text.empty()) return 0;
  if (text.size() > 10000000 || query.size() > 10000) return 65;
  int n=(int)text.size(), m=(int)query.size();
  unsigned char *dt=nullptr, *dq=nullptr, *do_=nullptr;
  CHECK(cudaMalloc((void**)&dt,n));
  CHECK(cudaMalloc((void**)&dq,m));
  CHECK(cudaMalloc((void**)&do_,n));
  CHECK(cudaMemcpy(dt,text.data(),n,cudaMemcpyHostToDevice));
  CHECK(cudaMemcpy(dq,query.data(),m,cudaMemcpyHostToDevice));
  match_kernel<<<(n+255)/256,256>>>(dt,n,dq,m,do_);
  CHECK(cudaGetLastError());
  std::vector<unsigned char> matches(n);
  CHECK(cudaMemcpy(matches.data(),do_,n,cudaMemcpyDeviceToHost));
  for(int i=0;i<n;++i) if(matches[i]) printf("%d\n",i);
  cudaFree(dt); cudaFree(dq); cudaFree(do_);
  return 0;
}
