package br.com.atelier;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class AtelierApplication {

    public static void main(String[] args) {
        SpringApplication.run(AtelierApplication.class, args);
    }
}
