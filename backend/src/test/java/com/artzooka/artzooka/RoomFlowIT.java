package com.artzooka.artzooka;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
public class RoomFlowIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("artzooka_test")
            .withUsername("postgres")
            .withPassword("root");

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Test
    void create_join_start_hides_imposter() {
        Map<?,?> room = rest.postForObject(url("/api/rooms"), null, Map.class);
        assertThat(room).isNotNull();
        String code = (String) room.get("code");
        assertThat(code).isNotEmpty();

        Map<?,?> p1 = rest.postForObject(url("/api/rooms/"+code+"/join"), Map.of("name","A"), Map.class);
        Map<?,?> p2 = rest.postForObject(url("/api/rooms/"+code+"/join"), Map.of("name","B"), Map.class);
        Map<?,?> p3 = rest.postForObject(url("/api/rooms/"+code+"/join"), Map.of("name","C"), Map.class);
        assertThat(p1).containsKeys("playerId","isAdmin");
        assertThat(p2).containsKeys("playerId","isAdmin");
        assertThat(p3).containsKeys("playerId","isAdmin");

        Map<?,?> start = rest.postForObject(url("/api/rooms/"+code+"/start"), null, Map.class);
        assertThat(start).containsKeys("gameId","roomId","promptCommon");
        assertThat(start).doesNotContainKeys("imposterId","promptImposter");
    }

    private String url(String path) { return "http://localhost:"+port+path; }
}


