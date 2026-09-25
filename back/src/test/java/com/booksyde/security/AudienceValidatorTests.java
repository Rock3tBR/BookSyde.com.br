package com.booksyde.security;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class AudienceValidatorTests {
    private Jwt jwt(List<String> audience) {
        return Jwt.withTokenValue("token").header("alg", "none").subject("00000000-0000-0000-0000-000000000001")
            .audience(audience).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }
    @Test void acceptsExpectedAudience() { assertFalse(new AudienceValidator("authenticated").validate(jwt(List.of("authenticated"))).hasErrors()); }
    @Test void rejectsUnexpectedAudience() { assertTrue(new AudienceValidator("authenticated").validate(jwt(List.of("other"))).hasErrors()); }
}
