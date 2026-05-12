import type { VerificationMethod, Website } from "../entities/Website";

export interface IWebsiteRepository {
  findById(id: string): Promise<Website | null>;
  findByDomainAndUserId(domain: string, userId: string): Promise<Website | null>;
  findVerifiedByDomain(domain: string): Promise<Website | null>;
  findByUserId(userId: string): Promise<Website[]>;
  create(data: { domain: string; userId: string }): Promise<Website>;
  markVerified(id: string, method: VerificationMethod): Promise<Website>;
  deleteUnverifiedByDomain(domain: string, excludeUserId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
