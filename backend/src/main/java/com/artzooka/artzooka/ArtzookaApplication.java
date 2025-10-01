package com.artzooka.artzooka;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ArtzookaApplication {
public static void main(String[] args) {
SpringApplication.run(ArtzookaApplication.class, args);
}
}
