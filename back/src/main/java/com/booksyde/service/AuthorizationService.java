package com.booksyde.service;

import com.booksyde.security.BooksydeRole;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service("authorizationService")
public class AuthorizationService {
    private final AuthenticatedUserService users;
    public AuthorizationService(AuthenticatedUserService users) { this.users = users; }
    public boolean hasRole(Authentication authentication, String role) {
        if (!(authentication.getPrincipal() instanceof Jwt jwt)) return false;
        try { return users.resolve(jwt).roles().contains(BooksydeRole.valueOf(role)); }
        catch (IllegalArgumentException ex) { return false; }
    }
    public boolean isSelfOrAdmin(Authentication authentication, UUID ownerId) {
        if (!(authentication.getPrincipal() instanceof Jwt jwt)) return false;
        UUID userId = UUID.fromString(jwt.getSubject());
        return userId.equals(ownerId) || users.resolve(jwt).roles().contains(BooksydeRole.ADMIN);
    }
}
