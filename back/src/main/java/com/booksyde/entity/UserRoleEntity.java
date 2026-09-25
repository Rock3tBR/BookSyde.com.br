package com.booksyde.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "user_roles", schema = "public")
public class UserRoleEntity {
    @Id @Column(name = "id", nullable = false) private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "role", nullable = false, columnDefinition = "app_role") private String role;
    protected UserRoleEntity() {}
    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getRole() { return role; }
}
