import { DeveloperContext, ContextRecommendation } from '../domain/entities/DeveloperContext';
import { DEV_COMMANDS } from '../data/devCommands';
import { MOCK_ARTICLES } from '../data/mockDictionaryData';
import { GUIDE_CHAPTERS } from '../data/guideChapters';
import { GUIDE_WORKFLOWS } from '../data/guideWorkflows';
import { DevCommand } from '../domain/entities/DevCommand';
import { GuideArticle } from '../domain/entities/GuideArticle';
import { GuideWorkflow } from '../domain/entities/GuideWorkflow';

export class DeveloperContextEngine {
  /**
   * Derive related commands based on active developer context (category, article, chapter, command)
   */
  static getRelatedCommands(context: DeveloperContext): DevCommand[] {
    const cat = (context.categoryId || '').toLowerCase();
    const cmdId = context.commandId;

    if (cmdId) {
      const activeCmd = DEV_COMMANDS.find((c) => c.id === cmdId);
      if (activeCmd && activeCmd.relatedCommandIds) {
        const related = DEV_COMMANDS.filter((c) => activeCmd.relatedCommandIds?.includes(c.id));
        if (related.length > 0) return related;
      }
    }

    // Filter commands by category or tags matching current category
    const catMatches = DEV_COMMANDS.filter(
      (c) =>
        c.categoryId.toLowerCase() === cat ||
        c.tags.some((t) => t.toLowerCase() === cat)
    );

    if (catMatches.length > 0) {
      return catMatches.slice(0, 5);
    }

    return DEV_COMMANDS.slice(0, 5);
  }

  /**
   * Derive related concepts & guide articles
   */
  static getRelatedArticles(context: DeveloperContext): GuideArticle[] {
    const cat = (context.categoryId || '').toLowerCase();
    const artId = context.articleId;

    if (artId) {
      const activeArt = MOCK_ARTICLES.find((a) => a.id === artId);
      if (activeArt) {
        const sameCategory = MOCK_ARTICLES.filter(
          (a) => a.categoryId === activeArt.categoryId && a.id !== artId
        );
        if (sameCategory.length > 0) return sameCategory.slice(0, 4);
      }
    }

    const catArticles = MOCK_ARTICLES.filter(
      (a) => a.categoryId.toLowerCase() === cat
    );
    if (catArticles.length > 0) return catArticles.slice(0, 4);

    return MOCK_ARTICLES.slice(0, 4);
  }

  /**
   * Derive related workflow based on context
   */
  static getRelatedWorkflow(context: DeveloperContext): GuideWorkflow | null {
    const cat = (context.categoryId || '').toLowerCase();
    const taskId = context.taskId;

    if (context.workflowId) {
      const activeWf = GUIDE_WORKFLOWS.find((w) => w.id === context.workflowId);
      if (activeWf) return activeWf;
    }

    if (taskId) {
      const taskWf = GUIDE_WORKFLOWS.find((w) => w.id.includes(taskId) || taskId.includes(w.id));
      if (taskWf) return taskWf;
    }

    const catWf = GUIDE_WORKFLOWS.find((w) => w.id.toLowerCase().includes(cat));
    return catWf || GUIDE_WORKFLOWS[0] || null;
  }

  /**
   * Derive intelligent Next Recommended Learning Step based on active context and progress
   */
  static getRecommendedNextStep(context: DeveloperContext): ContextRecommendation {
    const cat = (context.categoryId || 'docker').toLowerCase();

    // 1. Chapter / Section Progress based recommendation
    if (context.chapterId) {
      const chapter = GUIDE_CHAPTERS[context.chapterId];
      if (chapter) {
        const nextSec = chapter.sections.find(
          (sec) => !context.completedSectionIds.includes(sec.id)
        );
        if (nextSec) {
          return {
            title: `Next: ${nextSec.title}`,
            reason: `You are currently studying ${chapter.title}.`,
            targetType: 'chapter',
            targetId: chapter.id,
            category: chapter.categoryName,
          };
        }
      }
    }

    // 2. Command based recommendation
    if (context.commandId) {
      const activeCmd = DEV_COMMANDS.find((c) => c.id === context.commandId);
      if (activeCmd) {
        if (activeCmd.command.includes('reset')) {
          return {
            title: 'Learn Git Reflog Recovery',
            reason: 'You inspected git reset. Learn git reflog to recover uncommitted lost states.',
            targetType: 'article',
            targetId: 'git-recovery-undo-guide',
            category: 'Git',
          };
        }
        if (activeCmd.command.includes('docker run')) {
          return {
            title: 'Understand Container Lifecycle & Logs',
            reason: 'You just used docker run. Next learn docker ps and docker logs -f.',
            targetType: 'chapter',
            targetId: 'docker-containers-chapter',
            category: 'Docker',
          };
        }
      }
    }

    // 3. Category fallback recommendations
    if (cat === 'docker') {
      return {
        title: 'Container Storage Volumes & OverlayFS',
        reason: 'Master how Docker persists data outside container ephemeral layers.',
        targetType: 'chapter',
        targetId: 'docker-containers-chapter',
        category: 'Docker',
      };
    }

    if (cat === 'git') {
      return {
        title: 'Interactive Rebase & Commit Squashing',
        reason: 'Clean up local branch commit history before merging into main.',
        targetType: 'article',
        targetId: 'git-advanced-rebase-interactive',
        category: 'Git',
      };
    }

    return {
      title: 'AWS Identity & IAM Role Policies',
      reason: 'Configure principle of least privilege for cloud EC2 instances.',
      targetType: 'article',
      targetId: 'how-to-connect-ai-agent-to-aws',
      category: 'AWS',
    };
  }
}
