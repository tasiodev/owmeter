export interface GitHubInstallation {
  id: string;
  userId: string;
  installationId: number;
  targetType: string; // "User" | "Organization"
  targetLogin: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubRepo {
  id: number;
  fullName: string; // "owner/repo"
  private: boolean;
  defaultBranch: string;
}
