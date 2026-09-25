package com.booksyde.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "profiles", schema = "public")
public class ProfileEntity {
    @Id @Column(name = "id", nullable = false) private UUID id;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(name = "avatar_url") private String avatarUrl;
    protected ProfileEntity() {}
    public UUID getId() { return id; }
    public String getDisplayName() { return displayName; }
    public String getAvatarUrl() { return avatarUrl; }
    public void update(String displayName, String avatarUrl) { this.displayName = displayName; this.avatarUrl = avatarUrl; }
}
