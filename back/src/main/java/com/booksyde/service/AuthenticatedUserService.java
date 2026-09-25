package com.booksyde.service;

import com.booksyde.dto.response.CurrentUserResponse;
import com.booksyde.entity.UserRoleEntity;
import com.booksyde.repository.MarketplaceSellerRepository;
import com.booksyde.repository.ProfileRepository;
import com.booksyde.repository.UserRoleRepository;
import com.booksyde.security.AccountStatus;
import com.booksyde.security.BooksydeRole;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticatedUserService {
    private final UserRoleRepository roles;
    private final ProfileRepository profiles;
    private final MarketplaceSellerRepository sellers;
    public AuthenticatedUserService(UserRoleRepository roles, ProfileRepository profiles, MarketplaceSellerRepository sellers) {
        this.roles = roles; this.profiles = profiles; this.sellers = sellers;
    }
    @Transactional(readOnly = true)
    public CurrentUserResponse resolve(Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        Set<BooksydeRole> mapped = EnumSet.noneOf(BooksydeRole.class);
        roles.findAllByUserId(userId).stream().map(UserRoleEntity::getRole).map(this::mapRole).forEach(mapped::add);
        sellers.findById(userId).filter(s -> s.isActive()).ifPresent(s -> mapped.add(BooksydeRole.SELLER));
        if (mapped.isEmpty()) mapped.add(BooksydeRole.USER);
        String displayName = profiles.findById(userId).map(p -> p.getDisplayName()).orElse("Leitor");
        return new CurrentUserResponse(userId, jwt.getClaimAsString("email"), displayName, Set.copyOf(mapped), AccountStatus.ACTIVE);
    }
    private BooksydeRole mapRole(String raw) {
        return switch (raw.toLowerCase(Locale.ROOT)) {
            case "admin" -> BooksydeRole.ADMIN;
            case "editora", "publisher" -> BooksydeRole.PUBLISHER;
            case "creator" -> BooksydeRole.CREATOR;
            default -> BooksydeRole.USER;
        };
    }
}
