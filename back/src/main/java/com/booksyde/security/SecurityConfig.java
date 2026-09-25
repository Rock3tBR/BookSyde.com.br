package com.booksyde.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, CorsConfigurationSource cors) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .cors(c -> c.configurationSource(cors))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/v1/public/**", "/api/v1/books/public", "/api/v1/marketplace/public/**", "/api-docs/**", "/swagger-ui.html", "/swagger-ui/**", "/actuator/health").permitAll()
                .anyRequest().authenticated())
            .headers(h -> h
                .contentTypeOptions(c -> {})
                .frameOptions(f -> f.deny())
                .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                .permissionsPolicyHeader(p -> p.policy("camera=(), microphone=(), geolocation=()")))
            .oauth2ResourceServer(o -> o.jwt(jwt -> {}));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(@Value("${booksyde.security.supabase-url}") String supabaseUrl,
                          @Value("${booksyde.security.jwt-audience}") String audience) {
        String normalized = supabaseUrl.replaceAll("/+$", "");
        String issuer = normalized + "/auth/v1";
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(issuer + "/.well-known/jwks.json").build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), new AudienceValidator(audience)));
        return decoder;
    }
}
