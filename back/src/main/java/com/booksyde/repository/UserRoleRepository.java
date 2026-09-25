package com.booksyde.repository;
import com.booksyde.entity.UserRoleEntity;
import java.util.List; import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRoleRepository extends JpaRepository<UserRoleEntity, UUID> { List<UserRoleEntity> findAllByUserId(UUID userId); }
