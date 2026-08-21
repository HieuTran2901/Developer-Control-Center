import { useState } from 'react';
import { Icon, IconName } from '@/shared/components/ui/Icon';

export interface GraphNode {
  id: string;
  name: string;
  category: string;
  icon: IconName;
  description: string;
  relatedArticleId?: string;
}

export interface GraphTree {
  id: string;
  rootName: string;
  icon: IconName;
  nodes: GraphNode[];
}

const KNOWLEDGE_TREES: GraphTree[] = [
  {
    id: 'tree-docker',
    rootName: 'Docker Container Ecosystem',
    icon: 'Box',
    nodes: [
      {
        id: 'node-img',
        name: 'Docker Image',
        category: 'Immutable Template',
        icon: 'Layers',
        description: 'Read-only template with stacked filesystem layers built from a Dockerfile.',
        relatedArticleId: 'docker-cli-cheatsheet',
      },
      {
        id: 'node-net',
        name: 'Docker Network',
        category: 'Virtual Bridge',
        icon: 'Globe',
        description: 'Isolated virtual Ethernet bridges enabling inter-container communication.',
        relatedArticleId: 'docker-cli-cheatsheet',
      },
      {
        id: 'node-vol',
        name: 'Docker Volume',
        category: 'Persistent Storage',
        icon: 'Database',
        description: 'Host filesystem mounts bypassing OverlayFS to persist container data.',
        relatedArticleId: 'docker-cli-cheatsheet',
      },
      {
        id: 'node-comp',
        name: 'Docker Compose',
        category: 'Multi-Container Orchestration',
        icon: 'LayoutGrid',
        description: 'Declarative YAML specification for spinning up multi-container applications.',
        relatedArticleId: 'docker-cli-cheatsheet',
      },
    ],
  },
  {
    id: 'tree-git',
    rootName: 'Git Version Control Tree',
    icon: 'GitBranch',
    nodes: [
      {
        id: 'node-git-reset',
        name: 'Git Reset',
        category: 'Local History Rewriting',
        icon: 'RotateCcw',
        description: 'Moves conptr HEAD back to a previous commit (soft, mixed, or hard).',
        relatedArticleId: 'git-recovery-undo-guide',
      },
      {
        id: 'node-git-revert',
        name: 'Git Revert',
        category: 'Safe Production Undo',
        icon: 'Shield',
        description: 'Creates a new commit reversing a past commit without altering shared history.',
        relatedArticleId: 'git-recovery-undo-guide',
      },
      {
        id: 'node-git-rebase',
        name: 'Git Rebase',
        category: 'Linear History',
        icon: 'GitMerge',
        description: 'Re-applies local commits on top of another base tip for clean commit graphs.',
        relatedArticleId: 'git-advanced-rebase-interactive',
      },
      {
        id: 'node-git-cherry',
        name: 'Git Cherry-Pick',
        category: 'Single Commit Copy',
        icon: 'Copy',
        description: 'Applies a single specific commit from another branch onto current HEAD.',
        relatedArticleId: 'git-branching-merging-cheatsheet',
      },
    ],
  },
  {
    id: 'tree-react',
    rootName: 'React State & Hooks Architecture',
    icon: 'Code',
    nodes: [
      {
        id: 'node-usestate',
        name: 'useState',
        category: 'Component State',
        icon: 'Sliders',
        description: 'Declares reactive local state variables preserved across component re-renders.',
        relatedArticleId: 'react-hooks-handbook',
      },
      {
        id: 'node-useeffect',
        name: 'useEffect',
        category: 'Side Effects',
        icon: 'Zap',
        description: 'Synchronizes component with external systems (API calls, subscriptions, DOM).',
        relatedArticleId: 'react-hooks-handbook',
      },
      {
        id: 'node-usecontext',
        name: 'useContext',
        category: 'Global Context',
        icon: 'Share2',
        description: 'Consumes context values without prop-drilling through intermediate components.',
        relatedArticleId: 'react-hooks-handbook',
      },
      {
        id: 'node-usereducer',
        name: 'useReducer',
        category: 'Complex State Logic',
        icon: 'Cpu',
        description: 'Manages state transitions using dispatch actions and reducer functions.',
        relatedArticleId: 'react-hooks-handbook',
      },
    ],
  },
];

interface KnowledgeGraphProps {
  onOpenArticle?: (articleId: string) => void;
}

export function KnowledgeGraph({ onOpenArticle }: KnowledgeGraphProps) {
  const [activeTreeId, setActiveTreeId] = useState<string>(KNOWLEDGE_TREES[0].id);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    KNOWLEDGE_TREES[0].nodes[0].id
  );

  const activeTree =
    KNOWLEDGE_TREES.find((t) => t.id === activeTreeId) || KNOWLEDGE_TREES[0];
  const activeNode =
    activeTree.nodes.find((n) => n.id === selectedNodeId) || activeTree.nodes[0];

  return (
    <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="GitMerge" className="w-4 h-4 text-primary" />
          <span>Interactive Knowledge Graph</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          Explore Concept Dependencies
        </span>
      </div>

      {/* Tree Selector Chips */}
      <div className="flex flex-wrap gap-1.5">
        {KNOWLEDGE_TREES.map((tree) => {
          const isSelected = tree.id === activeTreeId;

          return (
            <button
              key={tree.id}
              type="button"
              onClick={() => {
                setActiveTreeId(tree.id);
                setSelectedNodeId(tree.nodes[0].id);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer flex items-center space-x-2 ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-bold border-primary shadow-xs'
                  : 'bg-background/60 border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tree.icon} className="w-3.5 h-3.5" />
              <span>{tree.rootName}</span>
            </button>
          );
        })}
      </div>

      {/* Visual Root Node & Branching Tree Nodes */}
      <div className="p-4 rounded-xl bg-background border border-border/80 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold font-mono text-primary bg-card p-2.5 rounded-lg border border-border/60">
          <Icon name={activeTree.icon} className="w-4 h-4 text-primary" />
          <span>Root: {activeTree.rootName}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {activeTree.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30 text-foreground'
                    : 'bg-card border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon
                    name={node.icon}
                    className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  {isSelected && (
                    <span className="text-[10px] font-mono text-primary font-bold">● Active</span>
                  )}
                </div>
                <div className="text-xs font-bold font-mono leading-tight">{node.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{node.category}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Node Details Box */}
      {activeNode && (
        <div className="p-4 rounded-xl bg-background border border-primary/30 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-primary flex items-center space-x-1.5">
              <Icon name={activeNode.icon} className="w-3.5 h-3.5" />
              <span>{activeNode.name}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">{activeNode.category}</span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {activeNode.description}
          </p>

          {activeNode.relatedArticleId && onOpenArticle && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onOpenArticle(activeNode.relatedArticleId!)}
                className="text-xs font-mono text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>[ Open Guide Article ]</span>
                <Icon name="ArrowRight" className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
