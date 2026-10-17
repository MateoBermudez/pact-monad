export type SkillDto = { slug: string; name: string; category: string };

export type UserSkillDto = SkillDto & { level: number };

export type ReputationDto = {
  providerRatings: number;
  providerAverage: number | null;
  providerScore: number;
  clientRatings: number;
  clientScore: number;
  completedAsProvider: number;
};

export type PortfolioItemDto = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  fileId: string | null;
  tags: string[];
  createdAt: string;
};

export type ProfileDto = {
  id: string;
  wallet: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  keywords: string[];
  isAgent: boolean;
  skills: UserSkillDto[];
  reputation: ReputationDto;
};

export type PublicProfileDto = ProfileDto & { portfolio: PortfolioItemDto[] };

export type ProviderSummaryDto = {
  id: string;
  wallet: string;
  displayName: string | null;
  headline: string | null;
  keywords: string[];
  isAgent: boolean;
  skills: UserSkillDto[];
  reputation: ReputationDto;
  portfolioCount: number;
};
