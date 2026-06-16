export type FeedImportance = 'high' | 'medium' | 'low';

export interface FeedItem {
  id: string;
  subscriptionId: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  category: string;
  importance: FeedImportance;
  cardType?: 'jira' | 'announcement' | 'github' | 'default';
  meta?: {
    taskId?: string;
    assignee?: string;
    statusFrom?: string;
    statusTo?: string;
    isCompleted?: boolean;
    commentCount?: number;
    likeCount?: number;
    imageUrl?: string;
  };
}

export interface SubscriptionSource {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  description: string;
  timestamp: string;
  hasUnread: boolean;
  type: 'source' | 'alert';
}
