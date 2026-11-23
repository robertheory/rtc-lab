# syntax=docker/dockerfile:1
# Own Dockerfile (the upstream one hardcodes GOARCH=amd64).
# Build context: services/danfse
FROM golang:1.27.1 AS build
ARG TARGETARCH
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -o /danfse-service ./cmd/danfse

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -u 10001 app
ENV TZ=America/Sao_Paulo
WORKDIR /app
COPY --from=build /danfse-service /app/danfse-service
USER app
EXPOSE 8080
ENTRYPOINT ["/app/danfse-service"]
