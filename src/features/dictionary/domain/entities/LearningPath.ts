import { IconName } from '@/shared/components/ui/Icon';

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  completedCount: number;
  totalCount: number;
  categoryIds: string[];
  currentTopic: string;
  nextTopic: string;
}
