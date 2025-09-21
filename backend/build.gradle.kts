plugins {
id("org.springframework.boot") version "3.3.3"
id("io.spring.dependency-management") version "1.1.6"
java
}

group = "com.artzooka"
version = "0.1.0"

java {
toolchain {
languageVersion.set(JavaLanguageVersion.of(17))
}
sourceCompatibility = JavaVersion.VERSION_17
targetCompatibility = JavaVersion.VERSION_17
}

repositories { mavenCentral() }

dependencies {
implementation("org.springframework.boot:spring-boot-starter-web")
implementation("org.springframework.boot:spring-boot-starter-websocket")
implementation("org.springframework.boot:spring-boot-starter-data-jpa")
implementation("org.flywaydb:flyway-core")
	implementation("org.flywaydb:flyway-database-postgresql")
implementation("org.postgresql:postgresql")
implementation("org.springframework.boot:spring-boot-starter-validation")
implementation("org.springframework.boot:spring-boot-starter-actuator")

testImplementation("org.springframework.boot:spring-boot-starter-test")
testImplementation("org.testcontainers:junit-jupiter:1.19.8")
testImplementation("org.testcontainers:postgresql:1.19.8")
}

tasks.test {
useJUnitPlatform()
}
