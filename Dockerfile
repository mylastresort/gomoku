FROM rust:1-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/gomoku /usr/local/bin/gomoku
COPY ai ./ai
EXPOSE 8000
CMD ["gomoku", "--port", "8000"]
