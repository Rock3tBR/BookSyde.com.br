package com.booksyde.controller;

import com.booksyde.dto.response.CurrentUserResponse;
import com.booksyde.service.AuthenticatedUserService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@SecurityRequirement(name = "bearerAuth")
public class AuthController {
    private final AuthenticatedUserService users;
    public AuthController(AuthenticatedUserService users) { this.users = users; }
    @GetMapping("/me") public CurrentUserResponse me(@AuthenticationPrincipal Jwt jwt) { return users.resolve(jwt); }
}
