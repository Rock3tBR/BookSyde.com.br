package com.booksyde.dto.response;

import java.time.Instant;
import java.util.Map;

public record ApiErrorResponse(int status, String code, String message, Instant timestamp, Map<String, String> fields) {
    public static ApiErrorResponse of(int status, String code, String message) {
        return new ApiErrorResponse(status, code, message, Instant.now(), Map.of());
    }
}
