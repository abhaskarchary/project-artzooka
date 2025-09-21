package com.artzooka.artzooka.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class StaticConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadsDir = Path.of("uploads").toAbsolutePath().normalize();
        registry.addResourceHandler("/static/**")
                .addResourceLocations("file:" + uploadsDir.toString() + "/");
    }
}
