import { apiRequest } from "./apiClient"; export const sellersApi={me:()=>apiRequest<{userId:string;sandboxReady:boolean;liveReady:boolean;featured:boolean}>("/api/v1/sellers/me")};
