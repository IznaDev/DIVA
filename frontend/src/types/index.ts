export interface Post {
  id?: bigint;
  poster: string;
  contentUrl: string;
  timestamp?: number;
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
  };
}
