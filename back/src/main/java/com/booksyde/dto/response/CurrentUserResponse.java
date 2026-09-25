package com.booksyde.dto.response;
import com.booksyde.security.AccountStatus; import com.booksyde.security.BooksydeRole;
import java.util.Set; import java.util.UUID;
public record CurrentUserResponse(UUID userId, String email, String displayName, Set<BooksydeRole> roles, AccountStatus status) {}
