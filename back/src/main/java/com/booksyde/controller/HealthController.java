package com.booksyde.controller;
import java.util.Map; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/public")
public class HealthController { @GetMapping("/health") public Map<String,String> health() { return Map.of("status", "ok"); } }
