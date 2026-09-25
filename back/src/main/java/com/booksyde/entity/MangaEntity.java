package com.booksyde.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "mangas", schema = "public")
public class MangaEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable=false) private String title;
    @Column(nullable=false) private String author = "";
    @Column(nullable=false) private String category = "";
    @Column(nullable=false) private String description = "";
    @Column(nullable=false) private String synopsis = "";
    @Column(name="work_type", nullable=false) private String workType;
    @Column(name="creator_id") private UUID creatorId;
    @Column(nullable=false, unique=true) private String slug;
    @Column(nullable=false) private String visibility = "private";
    @Column(nullable=false) private String status = "ongoing";
    @Column(name="is_collection", nullable=false) private boolean collection;
    @Column(name="cover_url") private String coverUrl;
    @Column(name="price_cents", nullable=false) private int priceCents;
    @Column(nullable=false) private String currency = "BRL";
    @Column(name="distribution_channel", nullable=false) private String distributionChannel = "unlisted";
    @Column(name="view_count", nullable=false) private int viewCount;
    @Column(name="created_at", insertable=false, updatable=false) private OffsetDateTime createdAt;
    protected MangaEntity() {}
    public MangaEntity(String title,String author,String category,String description,String synopsis,String workType,UUID creatorId,String slug,String visibility,boolean collection,String coverUrl,int priceCents,String distributionChannel){this.title=title;this.author=author;this.category=category;this.description=description;this.synopsis=synopsis;this.workType=workType;this.creatorId=creatorId;this.slug=slug;this.visibility=visibility;this.collection=collection;this.coverUrl=coverUrl;this.priceCents=priceCents;this.distributionChannel=distributionChannel;}
    public UUID getId(){return id;} public String getTitle(){return title;} public String getAuthor(){return author;} public String getCategory(){return category;} public String getDescription(){return description;} public String getSynopsis(){return synopsis;} public String getWorkType(){return workType;} public UUID getCreatorId(){return creatorId;} public String getSlug(){return slug;} public String getVisibility(){return visibility;} public String getStatus(){return status;} public boolean isCollection(){return collection;} public String getCoverUrl(){return coverUrl;} public int getPriceCents(){return priceCents;} public String getCurrency(){return currency;} public String getDistributionChannel(){return distributionChannel;} public int getViewCount(){return viewCount;} public OffsetDateTime getCreatedAt(){return createdAt;}
    public void update(String title,String author,String category,String description,String synopsis,String visibility,String coverUrl,int priceCents,String distributionChannel){this.title=title;this.author=author;this.category=category;this.description=description;this.synopsis=synopsis;this.visibility=visibility;this.coverUrl=coverUrl;this.priceCents=priceCents;this.distributionChannel=distributionChannel;}
}
