# Mistral-7B Deployment Guide

This directory contains deployment configuration for Mistral-7B using Hugging Face Text Generation Inference (TGI) for production-grade local LLM inference.

## Overview

Mistral-7B is a 7.3B parameter language model developed by Mistral AI. This deployment setup provides both containerized TGI server deployment and local Python-based inference options.

## Prerequisites

- Docker Engine 20.10 or higher
- NVIDIA GPU with CUDA support (recommended for optimal performance)
- At least 8GB VRAM for quantized inference
- 16GB+ RAM for CPU-only inference

## Deployment Options

### Option 1: TGI Server Deployment (Recommended)

#### Quick Start

```bash
# Build the TGI container
docker build -t mistral-7b-tgi .

# Run with GPU support (recommended)
docker run --gpus all -p 8080:80 mistral-7b-tgi

# Run CPU-only (slower but works without GPU)
docker run -p 8080:80 mistral-7b-tgi --device cpu
```

#### Custom Configuration

```bash
# Run with custom parameters
docker run --gpus all -p 8080:80 mistral-7b-tgi \
  --model-id mistralai/Mistral-7B-Instruct-v0.2 \
  --quantize bitsandbytes-nf4 \
  --max-concurrent-requests 128 \
  --max-total-tokens 4096 \
  --max-input-length 2048
```

#### API Usage

Once the server is running, you can make requests to the inference endpoint:

```bash
# Health check
curl http://localhost:8080/health

# Generate text
curl -X POST http://localhost:8080/generate \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": "What is the capital of France?",
    "parameters": {
      "max_new_tokens": 100,
      "temperature": 0.7,
      "top_p": 0.95
    }
  }'
```

#### Python Client Example

```python
import requests
import json

def query_mistral(prompt, max_tokens=100, temperature=0.7):
    url = "http://localhost:8080/generate"
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": max_tokens,
            "temperature": temperature,
            "top_p": 0.95,
            "do_sample": True
        }
    }
    
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        return response.json()["generated_text"]
    else:
        raise Exception(f"Error: {response.status_code} - {response.text}")

# Example usage
result = query_mistral("Explain quantum computing in simple terms:")
print(result)
```

### Option 2: Local Python Inference

#### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# For CUDA support (if you have NVIDIA GPU)
pip install torch==2.1.2+cu121 torchvision==0.16.2+cu121 torchaudio==2.1.2+cu121 -f https://download.pytorch.org/whl/torch_stable.html
```

#### Basic Usage

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# Load model and tokenizer
model_name = "mistralai/Mistral-7B-v0.1"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto",
    load_in_4bit=True,  # Enable 4-bit quantization
    trust_remote_code=True
)

def generate_response(prompt, max_length=512, temperature=0.7):
    inputs = tokenizer(prompt, return_tensors="pt")
    
    with torch.no_grad():
        outputs = model.generate(
            inputs.input_ids,
            max_length=max_length,
            temperature=temperature,
            do_sample=True,
            top_p=0.95,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return response[len(prompt):]  # Return only the generated part

# Example usage
prompt = "What are the benefits of renewable energy?"
response = generate_response(prompt)
print(f"Prompt: {prompt}")
print(f"Response: {response}")
```

#### Jupyter Notebook Setup

```python
# Cell 1: Setup
%pip install -r requirements.txt
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

# Cell 2: Load Model
model_name = "mistralai/Mistral-7B-v0.1"
print(f"Loading {model_name}...")

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto",
    load_in_4bit=True
)

print("Model loaded successfully!")

# Cell 3: Interactive Generation
def chat_with_mistral(prompt):
    inputs = tokenizer(prompt, return_tensors="pt")
    outputs = model.generate(
        inputs.input_ids,
        max_length=512,
        temperature=0.7,
        do_sample=True,
        top_p=0.95,
        pad_token_id=tokenizer.eos_token_id
    )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Interactive loop
while True:
    user_input = input("You: ")
    if user_input.lower() in ['quit', 'exit', 'bye']:
        break
    
    response = chat_with_mistral(user_input)
    print(f"Mistral: {response[len(user_input):]}")
```

## Performance Optimization

### Memory Requirements

| Configuration | VRAM Required | RAM Required | Performance |
|---------------|---------------|---------------|-------------|
| FP16 (Full)   | ~14GB        | 16GB+        | Best        |
| 8-bit         | ~7GB         | 12GB+        | Good        |
| 4-bit (NF4)   | ~4GB         | 8GB+         | Moderate    |
| CPU Only      | 0GB          | 16GB+        | Slow        |

### Optimization Tips

1. **Use Quantization**: 4-bit quantization significantly reduces memory usage
2. **Batch Processing**: Process multiple requests together for better throughput
3. **Caching**: Implement response caching for repeated queries
4. **GPU Selection**: Use `CUDA_VISIBLE_DEVICES` to select specific GPUs

## Integration with Supreme AI Deployment Hub

This Mistral-7B deployment can be integrated with the main deployment hub API:

### API Proxy Setup

```python
# In src/main.py, add Mistral-7B endpoint
@app.post("/proxy/mistral/generate")
async def proxy_mistral_generate(data: ChatRequest):
    # Forward requests to local TGI instance
    response = await httpx.post(
        "http://localhost:8080/generate",
        json={
            "inputs": data.prompt,
            "parameters": {
                "max_new_tokens": data.max_tokens or 512,
                "temperature": data.temperature,
            }
        }
    )
    return CompletionResult(
        completion=response.json()["generated_text"],
        model="mistralai/Mistral-7B-v0.1",
        usage={"prompt_tokens": len(data.prompt)}
    )
```

## Monitoring and Logging

### TGI Server Metrics

The TGI server exposes metrics on `/metrics` endpoint for Prometheus monitoring:

```bash
# Check metrics
curl http://localhost:8080/metrics
```

### Performance Monitoring

```python
import time
import psutil
import GPUtil

def monitor_inference():
    # Monitor GPU usage
    gpus = GPUtil.getGPUs()
    for gpu in gpus:
        print(f"GPU {gpu.id}: {gpu.memoryUsed}MB / {gpu.memoryTotal}MB")
    
    # Monitor CPU and RAM
    print(f"CPU: {psutil.cpu_percent()}%")
    print(f"RAM: {psutil.virtual_memory().percent}%")

# Time inference
start_time = time.time()
response = generate_response("Test prompt")
end_time = time.time()
print(f"Inference time: {end_time - start_time:.2f} seconds")
```

## Troubleshooting

### Common Issues

1. **CUDA Out of Memory**
   - Enable 4-bit quantization: `load_in_4bit=True`
   - Reduce batch size or max_length
   - Use gradient checkpointing

2. **Slow Inference on CPU**
   - Consider using smaller models or quantization
   - Increase CPU threads: `torch.set_num_threads()`

3. **Model Loading Errors**
   - Check internet connectivity for model download
   - Verify disk space (model is ~13GB)
   - Clear Hugging Face cache if corrupted

### Debug Commands

```bash
# Check GPU availability
python -c "import torch; print(torch.cuda.is_available())"

# Check TGI server logs
docker logs <container_id>

# Test model loading
python -c "from transformers import AutoTokenizer; AutoTokenizer.from_pretrained('mistralai/Mistral-7B-v0.1')"
```

## Security Considerations

1. **API Access**: Secure the TGI endpoint with authentication in production
2. **Resource Limits**: Set memory and CPU limits for Docker containers
3. **Network**: Use internal networks and firewalls to restrict access
4. **Model Updates**: Regularly update to latest model versions for security patches

## License

Mistral-7B is released under the Apache 2.0 License. See the [Mistral AI repository](https://github.com/mistralai/mistral-src) for details.

## Support

For issues specific to this deployment:
1. Check the troubleshooting section above
2. Review TGI documentation: https://github.com/huggingface/text-generation-inference
3. Mistral AI documentation: https://docs.mistral.ai/

For integration with Supreme AI Deployment Hub, refer to the main project documentation.