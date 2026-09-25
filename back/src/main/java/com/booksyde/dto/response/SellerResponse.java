package com.booksyde.dto.response; import java.util.UUID; public record SellerResponse(UUID userId,boolean sandboxReady,boolean liveReady,boolean featured){}
