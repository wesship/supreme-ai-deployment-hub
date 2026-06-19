from setuptools import setup, find_packages

setup(
    name="devonnbench",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "httpx>=0.27.0",
        "pydantic>=2.0.0",
        "pyyaml>=6.0",
        "click>=8.1.0",
    ],
    entry_points={
        "console_scripts": [
            "devonnbench=devonnbench.cli:main",
        ],
    },
    python_requires=">=3.11",
)
