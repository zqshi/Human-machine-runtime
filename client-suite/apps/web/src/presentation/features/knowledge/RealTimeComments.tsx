/**
 * RealTimeComments — 实时协作评论面板 (real_time_comments 对齐)
 * 评论线程列表 + 回复输入框 + 选中锚定提示
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { useToastStore } from '../../../application/stores/toastStore';

interface CommentReply {
  id: string;
  author: string;
  avatar: string;
  time: string;
  content: string;
}

export interface CommentThread {
  id: string;
  author: string;
  avatar: string;
  time: string;
  content: string;
  anchorText?: string;
  replies: CommentReply[];
  resolved?: boolean;
}

interface RealTimeCommentsProps {
  onClose?: () => void;
  comments?: CommentThread[];
}

export function RealTimeComments({ onClose, comments = [] }: RealTimeCommentsProps) {
  return (
    <div className="w-80 border-l border-border bg-bg-secondary overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">实时评论</h3>
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
            {comments.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('评论筛选功能开发中', 'info')}
            className="p-1 rounded-md hover:bg-bg-hover text-text-muted"
          >
            <Icon name="filter_list" size={16} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:bg-bg-hover text-text-secondary"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-text-muted">
            暂无评论
          </div>
        ) : (
          comments.map((thread) => <CommentThreadItem key={thread.id} thread={thread} />)
        )}
      </div>

      {/* Hint */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-text-muted text-center">
          <Icon name="mode_comment" size={12} className="inline mr-1" />
          选中正文文字即可添加评论
        </p>
      </div>
    </div>
  );
}

function CommentThreadItem({ thread }: { thread: CommentThread }) {
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [resolved, setResolved] = useState(!!thread.resolved);

  return (
    <div
      className={`px-4 py-3 border-b border-border/50 transition-colors ${resolved ? 'opacity-60' : 'border-l-4 border-l-primary hover:bg-bg-hover/30'}`}
    >
      {/* Resolved badge */}
      {resolved && (
        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-medium text-success">
          <Icon name="check_circle" size={12} />
          已解决
        </div>
      )}
      {/* Anchor text highlight */}
      {thread.anchorText && (
        <div className="mb-2 px-2 py-1 bg-[#FFEB3B]/15 rounded text-[10px] text-text-secondary border-l-2 border-[#FFEB3B] truncate">
          "{thread.anchorText}"
        </div>
      )}

      {/* Main comment */}
      <div className="flex gap-2">
        <Avatar letter={thread.avatar} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary">{thread.author}</span>
            <span className="text-[10px] text-text-muted">{thread.time}</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mt-0.5">{thread.content}</p>
        </div>
      </div>

      {/* Replies */}
      {thread.replies.map((reply) => (
        <div key={reply.id} className="flex gap-2 mt-2 ml-9">
          <Avatar letter={reply.avatar} size={24} gradient="bg-emerald-500" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-text-primary">{reply.author}</span>
              <span className="text-[10px] text-text-muted">{reply.time}</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
              {reply.content}
            </p>
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-2 ml-9">
        <button
          type="button"
          onClick={() => setShowReply(!showReply)}
          className="text-[10px] text-primary hover:text-primary/80 font-medium"
        >
          回复
        </button>
        <button
          type="button"
          onClick={() => setResolved(!resolved)}
          className={`text-[10px] font-medium ${resolved ? 'text-success' : 'text-text-muted hover:text-primary'}`}
        >
          {resolved ? '重新打开' : '解决'}
        </button>
      </div>

      {/* Reply input */}
      {showReply && (
        <div className="mt-2 ml-9 flex items-center gap-1.5">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="回复..."
            className="flex-1 px-2.5 py-1.5 text-[11px] border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={() => {
              useToastStore.getState().addToast('回复已发送', 'info');
              setReplyText('');
              setShowReply(false);
            }}
            className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90"
          >
            <Icon name="send" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
