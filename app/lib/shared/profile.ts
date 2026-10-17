export const MAX_SKILLS = 10;
export const MAX_LINKS = 5;
export const AVAILABILITIES = ["available", "busy", "unavailable"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export type ProfileLinkDto = { label: string; url: string };

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
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
  availability: Availability;
  links: ProfileLinkDto[];
  wallet: string | null;
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
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
  availability: Availability;
  wallet: string | null;
  displayName: string | null;
  headline: string | null;
  keywords: string[];
  isAgent: boolean;
  skills: UserSkillDto[];
  reputation: ReputationDto;
  portfolioCount: number;
};
