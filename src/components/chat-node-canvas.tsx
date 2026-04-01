"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { ChatThread } from "app-types/chat";
import { Character } from "app-types/character";
import { cn } from "lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Button } from "ui/button";
import { ChevronLeft, ChevronRight, MessageCircle, Sparkles, GitBranch } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ChatNode = {
  id: string;
  title: string;
  lastMessageAt: number;
  isMainChat?: boolean;
  parentId?: string;
};

type Props = {
  character: Character;
  threads: (ChatThread & { lastMessageAt: number })[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onStartNewChat: () => void;
  isLoading?: boolean;
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 90;
const HORIZONTAL_GAP = 30;
const VERTICAL_GAP = 50;
const BRANCH_INDENT = 40;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const SCALE_SENSITIVITY = 0.001;

interface TreeNode {
  thread: ChatThread & { lastMessageAt: number };
  children: TreeNode[];
  depth: number;
}

export function ChatNodeCanvas({
  character,
  threads,
  currentThreadId,
  onSelectThread,
  onStartNewChat,
  isLoading,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Build tree structure from threads
  const treeStructure = useMemo(() => {
    // Separate root threads (no parent) from branches
    const rootThreads: (ChatThread & { lastMessageAt: number })[] = [];
    const branchesByParent = new Map<string, (ChatThread & { lastMessageAt: number })[]>();

    threads.forEach(thread => {
      if (thread.parentThreadId) {
        // This is a branch
        const siblings = branchesByParent.get(thread.parentThreadId) || [];
        siblings.push(thread);
        branchesByParent.set(thread.parentThreadId, siblings);
      } else {
        // This is a root thread
        rootThreads.push(thread);
      }
    });

    // Build tree recursively
    const buildTree = (thread: ChatThread & { lastMessageAt: number }, depth: number): TreeNode => {
      const children = (branchesByParent.get(thread.id) || [])
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt) // Most recent first
        .map(child => buildTree(child, depth + 1));

      return { thread, children, depth };
    };

    // Sort roots by last message time (most recent first)
    rootThreads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    return rootThreads.map(root => buildTree(root, 0));
  }, [threads]);

  // Flatten tree for navigation (depth-first)
  const flatNodes = useMemo(() => {
    const flat: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        flat.push(node);
        traverse(node.children);
      });
    };
    traverse(treeStructure);
    return flat;
  }, [treeStructure]);

  // Calculate positions with tree layout
  const nodePositions = useMemo(() => {
    const positions: Map<string, { x: number; y: number; depth: number }> = new Map();
    
    let currentY = 0;
    
    const layoutNode = (node: TreeNode, x: number): number => {
      const y = currentY;
      positions.set(node.thread.id, { x, y, depth: node.depth });
      
      // Layout children (branches) below this node
      const childX = x + BRANCH_INDENT;
      node.children.forEach((child, index) => {
        if (index > 0) {
          currentY += NODE_HEIGHT + VERTICAL_GAP;
        }
        layoutNode(child, childX);
      });
      
      return y;
    };

    treeStructure.forEach((root, index) => {
      if (index > 0) {
        currentY += NODE_HEIGHT + VERTICAL_GAP;
      }
      layoutNode(root, 0);
    });

    return positions;
  }, [treeStructure]);

  // Find current node index
  const currentNodeIndex = useMemo(() => {
    return flatNodes.findIndex(n => n.thread.id === currentThreadId);
  }, [flatNodes, currentThreadId]);

  // Center on a specific node
  const centerOnNode = useCallback((threadId: string) => {
    if (!containerRef.current) return;
    
    const pos = nodePositions.get(threadId);
    if (!pos) return;
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    setOffset({
      x: containerWidth / 2 - pos.x - NODE_WIDTH / 2 - pos.depth * BRANCH_INDENT,
      y: containerHeight / 2 - pos.y - NODE_HEIGHT / 2,
    });
  }, [nodePositions]);

  // Initialize and center on current thread
  useEffect(() => {
    if (currentThreadId && flatNodes.length > 0) {
      centerOnNode(currentThreadId);
    }
  }, [currentThreadId, flatNodes.length, centerOnNode]);

  // Handle mouse/touch drag
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * SCALE_SENSITIVITY;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));
      setScale(newScale);
    }
  };

  // Navigation - switch to prev/next conversation
  const goToPrevious = () => {
    const currentIndex = currentNodeIndex >= 0 ? currentNodeIndex : 0;
    if (currentIndex > 0) {
      const prevNode = flatNodes[currentIndex - 1];
      onSelectThread(prevNode.thread.id);
      centerOnNode(prevNode.thread.id);
    }
  };

  const goToNext = () => {
    const currentIndex = currentNodeIndex >= 0 ? currentNodeIndex : -1;
    if (currentIndex < flatNodes.length - 1) {
      const nextNode = flatNodes[currentIndex + 1];
      onSelectThread(nextNode.thread.id);
      centerOnNode(nextNode.thread.id);
    }
  };

  // Handle node click
  const handleNodeClick = (threadId: string) => {
    onSelectThread(threadId);
    centerOnNode(threadId);
  };

  // Calculate canvas size
  const canvasSize = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    let maxDepth = 0;
    
    nodePositions.forEach((pos) => {
      maxX = Math.max(maxX, pos.x + NODE_WIDTH);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
      maxDepth = Math.max(maxDepth, pos.depth);
    });
    
    return { 
      width: maxX + maxDepth * BRANCH_INDENT + 100, 
      height: maxY + 200 
    };
  }, [nodePositions]);

  // Current node for display
  const currentNode = flatNodes[currentNodeIndex];

  return (
    <div className="relative w-full h-full overflow-hidden bg-muted/30 rounded-xl border">
      {/* Navigation arrows */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 border shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={goToPrevious}
          disabled={currentNodeIndex <= 0}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[100px] text-center truncate">
          {currentNode?.thread.title || (flatNodes.length === 0 ? "No chats" : "Select a chat")}
          {currentNode && currentNode.depth > 0 && (
            <span className="text-primary ml-1">• Branch</span>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={goToNext}
          disabled={currentNodeIndex >= flatNodes.length - 1}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* New chat button */}
      <Button
        variant="default"
        size="sm"
        className="absolute top-3 right-3 z-20"
        onClick={onStartNewChat}
      >
        <Sparkles className="size-4 mr-1" />
        New Chat
      </Button>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 border text-xs text-muted-foreground">
        <span>{Math.round(scale * 100)}%</span>
      </div>

      {/* Chat count */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 border text-xs text-muted-foreground">
        <MessageCircle className="size-3" />
        <span>{flatNodes.length} conversation{flatNodes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          "w-full h-full cursor-grab active:cursor-grabbing touch-none",
          isDragging && "cursor-grabbing"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <motion.div
          className="relative"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${NODE_WIDTH + HORIZONTAL_GAP}px ${NODE_HEIGHT + VERTICAL_GAP}px`,
            }}
          />

          {/* Connection lines */}
          <svg className="absolute inset-0 pointer-events-none" style={{ width: canvasSize.width, height: canvasSize.height }}>
            {flatNodes.map(node => {
              if (!node.thread.parentThreadId) return null;
              
              const parentPos = nodePositions.get(node.thread.parentThreadId);
              const childPos = nodePositions.get(node.thread.id);
              if (!parentPos || !childPos) return null;

              return (
                <path
                  key={`line-${node.thread.id}`}
                  d={`M ${parentPos.x + NODE_WIDTH} ${parentPos.y + NODE_HEIGHT / 2}
                      C ${parentPos.x + NODE_WIDTH + 20} ${parentPos.y + NODE_HEIGHT / 2},
                        ${childPos.x - 20} ${childPos.y + NODE_HEIGHT / 2},
                        ${childPos.x} ${childPos.y + NODE_HEIGHT / 2}`}
                  stroke="hsl(var(--primary) / 0.3)"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="4 4"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          <AnimatePresence>
            {flatNodes.map((node) => {
              const pos = nodePositions.get(node.thread.id);
              if (!pos) return null;

              const isCurrent = node.thread.id === currentThreadId;
              const isBranch = node.depth > 0;

              return (
                <motion.div
                  key={node.thread.id}
                  initial={{ opacity: 0, scale: 0.8, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "absolute rounded-xl border-2 bg-card p-3 cursor-pointer transition-all shadow-sm hover:shadow-md",
                    isCurrent && "border-primary ring-2 ring-primary/20 shadow-lg",
                    !isCurrent && isBranch && "border-primary/30 bg-primary/5",
                    !isCurrent && !isBranch && "border-border hover:border-primary/30"
                  )}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                  }}
                  onClick={() => handleNodeClick(node.thread.id)}
                >
                  <div className="flex items-start gap-2 h-full">
                    <Avatar className="size-9 rounded-lg border shrink-0">
                      <AvatarImage src={character.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-xs">
                        {character.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium truncate flex-1">
                          {node.thread.title || "New Chat"}
                        </p>
                        {isBranch && (
                          <GitBranch className="size-3 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {node.thread.lastMessageAt > 0
                          ? new Date(node.thread.lastMessageAt).toLocaleDateString()
                          : "New"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Message indicator */}
                  <div className="absolute bottom-2 right-2">
                    <MessageCircle className="size-3 text-muted-foreground" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {flatNodes.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="size-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No chats yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start a new conversation with {character.name}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}