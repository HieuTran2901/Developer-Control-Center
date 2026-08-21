import { IconName } from '@/shared/components/ui/Icon';
import { ArticleType } from './GuideArticle';

export interface GuideTask {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  categoryIds?: string[];
  subcategoryIds?: string[];
  tags?: string[];
  typeFilter?: ArticleType;
}
