import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { Icon } from '../../components/ui/Icon';

const QUICK_EMOJIS = ['😊', '👍', '❤️', '😂', '🎉', '🙏', '🔥', '✅', '👀', '💯', '🤔', '😅'];

const MENTIONABLE_USERS = [
  { userId: '@factory-bot:example.com', name: 'Factory Bot' },
  { userId: '@agent-coder:example.com', name: 'Code Assistant' },
  { userId: '@doc-writer:example.com', name: 'Doc Writer' },
  { userId: '@user2:example.com', name: 'Bob' },
  { userId: '@user3:example.com', name: 'Carol' },
];

interface ReplyPreview {
  eventId: string;
  senderName: string;
  body: string;
}

interface ChatComposerProps {
  onSend: (body: string) => void;
  onFileUpload?: (file: File) => void;
  onTyping?: (typing: boolean) => void;
  disabled?: boolean;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  editingBody?: string;
  onCancelEdit?: () => void;
}

/**
 * Extract the @mention query at the cursor position.
 * Returns the text after the last unmatched '@' before the cursor, or null if none.
 */
function getMentionQuery(text: string, cursorPos: number): { query: string; start: number } | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/@([^\s@]*)$/);
  if (!match) return null;
  return { query: match[1], start: before.length - match[0].length };
}

export function ChatComposer({
  onSend,
  onFileUpload,
  onTyping,
  disabled = false,
  replyTo,
  onCancelReply,
  editingBody,
  onCancelEdit,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredUsers =
    mentionQuery !== null
      ? MENTIONABLE_USERS.filter(
          (u) =>
            u.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            u.userId.toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 5)
      : [];

  const closeMention = useCallback(() => {
    setMentionQuery(null);
    setMentionStart(0);
  }, []);

  const insertMention = useCallback(
    (name: string) => {
      // Replace @query with @name + trailing space
      const before = text.slice(0, mentionStart);
      const cursorPos = textareaRef.current?.selectionStart ?? text.length;
      const after = text.slice(cursorPos);
      const inserted = `@${name} `;
      const newText = before + inserted + after;
      setText(newText);
      closeMention();

      // Restore focus & cursor
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          const pos = before.length + inserted.length;
          ta.selectionStart = pos;
          ta.selectionEnd = pos;
        }
      });
    },
    [text, mentionStart, closeMention]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    closeMention();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    onTyping?.(false);
  }, [text, onSend, onTyping, closeMention]);

  const handleCancelEdit = useCallback(() => {
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onCancelEdit?.();
  }, [onCancelEdit]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      if (mentionQuery !== null) {
        e.preventDefault();
        closeMention();
        return;
      }
      if (editingBody != null) {
        e.preventDefault();
        handleCancelEdit();
        return;
      }
      if (replyTo) {
        e.preventDefault();
        onCancelReply?.();
        return;
      }
    }
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      if (mentionQuery !== null) {
        e.preventDefault();
        closeMention();
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    const value = el.value;
    setText(value);

    // Auto-resize
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';

    // Mention detection
    const cursorPos = el.selectionStart ?? value.length;
    const mention = getMentionQuery(value, cursorPos);
    if (mention) {
      setMentionQuery(mention.query);
      setMentionStart(mention.start);
    } else {
      closeMention();
    }

    // Typing indicator: send typing=true, debounce typing=false after 3s
    onTyping?.(true);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      onTyping?.(false);
      typingTimerRef.current = null;
    }, 3000);
  };

  // Pre-fill text when entering edit mode (render-phase sync, avoids setState in effect)
  const [prevEditingBody, setPrevEditingBody] = useState<string | undefined>(undefined);
  if (editingBody != null && editingBody !== prevEditingBody) {
    setPrevEditingBody(editingBody);
    setText(editingBody);
  } else if (editingBody == null && prevEditingBody != null) {
    setPrevEditingBody(undefined);
  }

  useEffect(() => {
    if (editingBody != null) {
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.style.height = 'auto';
          ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
          ta.selectionStart = ta.value.length;
          ta.selectionEnd = ta.value.length;
        }
      });
    }
  }, [editingBody]);

  // Focus textarea when replying
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Cleanup typing timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const handleAttachClick = () => {
    fileRef.current?.click();
  };

  const handleImageClick = () => {
    imageRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    // Reset so the same file can be re-selected
    if (e.target === fileRef.current && fileRef.current) {
      fileRef.current.value = '';
    }
    if (e.target === imageRef.current && imageRef.current) {
      imageRef.current.value = '';
    }
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    const pos = ta?.selectionStart ?? text.length;
    const newText = text.slice(0, pos) + emoji + text.slice(pos);
    setText(newText);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        const newPos = pos + emoji.length;
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
      }
    });
  };

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  return (
    <div
      className={`relative mx-4 mb-3 rounded-xl bg-bg-white-var border ${editingBody != null ? 'border-amber-400' : 'border-border'}`}
    >
      {/* Reply preview bar */}
      {replyTo && !editingBody && (
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-b border-border/50">
          <div className="w-0.5 h-8 rounded-full bg-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary truncate">{replyTo.senderName}</p>
            <p className="text-xs text-text-muted truncate">{replyTo.body}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 w-5 h-5 rounded hover:bg-bg-hover flex items-center justify-center"
          >
            <Icon name="close" size={14} className="text-text-muted" />
          </button>
        </div>
      )}

      {/* Edit mode bar */}
      {editingBody != null && (
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-b border-amber-200">
          <Icon name="edit" size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs font-medium text-amber-600 flex-1">编辑消息</span>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="shrink-0 w-5 h-5 rounded hover:bg-bg-hover flex items-center justify-center"
          >
            <Icon name="close" size={14} className="text-text-muted" />
          </button>
        </div>
      )}

      {/* @Mention popup */}
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 w-56 bg-bg-white-var border border-border rounded-xl shadow-lg overflow-hidden z-50">
          {filteredUsers.map((u) => (
            <button
              key={u.userId}
              type="button"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-hover transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u.name);
              }}
            >
              <span className="w-7 h-7 rounded-full bg-primary-50 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                {u.name[0]}
              </span>
              <span className="text-sm text-text-primary truncate">{u.name}</span>
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
        disabled={disabled}
        rows={1}
        className="w-full min-h-[42px] px-3 py-2.5 text-sm bg-transparent resize-none outline-none text-text-primary placeholder:text-text-muted"
      />
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex gap-1 relative">
          <button
            type="button"
            onClick={handleAttachClick}
            className="w-7 h-7 rounded-lg text-text-muted hover:bg-bg-hover flex items-center justify-center"
          >
            <Icon name="attach_file" size={18} />
          </button>
          <div ref={emojiRef} className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-7 h-7 rounded-lg text-text-muted hover:bg-bg-hover flex items-center justify-center"
            >
              <Icon name="mood" size={18} />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-1 p-2 bg-bg-white-var border border-border rounded-xl shadow-lg z-50 grid grid-cols-6 gap-1 w-[200px]">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="w-7 h-7 rounded hover:bg-bg-hover flex items-center justify-center text-base"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleImageClick}
            className="w-7 h-7 rounded-lg text-text-muted hover:bg-bg-hover flex items-center justify-center"
          >
            <Icon name="image" size={18} />
          </button>
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="h-7 px-3 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-40 hover:bg-primary-dark transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  );
}
