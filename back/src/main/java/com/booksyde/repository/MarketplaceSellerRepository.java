package com.booksyde.repository;
import com.booksyde.entity.MarketplaceSellerEntity;
import java.util.UUID; import org.springframework.data.jpa.repository.JpaRepository;
public interface MarketplaceSellerRepository extends JpaRepository<MarketplaceSellerEntity, UUID> {}
