# Dockerfile for VoteChain contracts

FROM rust:latest

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Rust tools
RUN rustup target add wasm32-unknown-unknown && \
    rustup component add rustfmt clippy

# Install Stellar CLI
RUN cargo install --locked stellar-cli --features opt

WORKDIR /app

# Copy project files
COPY Cargo.toml Cargo.lock ./
COPY contracts ./contracts

# Build contracts
RUN stellar contract build

# Default command
CMD ["/bin/bash"]
