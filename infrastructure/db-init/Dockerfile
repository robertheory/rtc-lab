# syntax=docker/dockerfile:1
# One-shot job: builds the SQLite tax database from the official Flyway scripts
# of the regular-regime engine. The Simple Nacional engine reuses the same file.
FROM maven:3.9-eclipse-temurin-25
WORKDIR /build

COPY pom.xml ./
COPY flyway flyway

# Warm ~/.m2 (maven distribution, flyway plugin, project dependencies) INTO the image
# layer, so the job itself never needs the network. Deliberately no cache mount here:
# cache mounts are not persisted in the image.
# Build context: services/regime-regular (+ named context "scripts" = infrastructure/db-init)
RUN mkdir -p calculadora/db \
 && mvn -B -q flyway:info -Dflyway.configFiles=./flyway/flyway-pro.conf \
 && rm -rf calculadora

COPY --from=scripts init.sh /usr/local/bin/init-db.sh
RUN chmod +x /usr/local/bin/init-db.sh
ENTRYPOINT ["/usr/local/bin/init-db.sh"]
