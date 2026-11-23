# syntax=docker/dockerfile:1
# Own Dockerfile for the official engine (the upstream repo ships none).
# Build context: services/regime-regular
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY pom.xml lombok.config ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q -DskipTests package \
 && cp target/api-regime-geral.jar /app.jar

FROM eclipse-temurin:25-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --home-dir /app app \
 && mkdir -p /app/calculadora/db \
 && chown -R app /app
WORKDIR /app
COPY --from=build /app.jar /app/app.jar
USER app
# The offline profile reads ./calculadora/db relative to the working directory.
ENV SPRING_PROFILES_ACTIVE=offline
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
