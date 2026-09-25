package com.booksyde.repository;
import com.booksyde.entity.ProfileEntity;
import java.util.UUID; import org.springframework.data.jpa.repository.JpaRepository;
public interface ProfileRepository extends JpaRepository<ProfileEntity, UUID> {}
