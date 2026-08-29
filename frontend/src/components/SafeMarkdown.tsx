import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

function textFromChildren(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return textFromChildren((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

function CodeBlock({ children, className }: { children?: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = textFromChildren(children).replace(/\n$/, '');
  return <div className="code-block">
    <button className="code-copy" type="button" onClick={async () => {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }}>{copied ? '已复制' : '复制'}</button>
    <pre><code className={className}>{code}</code></pre>
  </div>;
}

export function SafeMarkdown({ children }: { children: string }) {
  return <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeSanitize]}
    components={{
      a: ({ href, children: linkChildren }) => {
        // 外部链接新标签页打开；应用内 hash 路由（#/settings/... 等引导链接）原位导航。
        const external = /^https?:\/\//i.test(href || '');
        return <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{linkChildren}</a>;
      },
      code: ({ className, children: codeChildren }) => {
        const value = textFromChildren(codeChildren);
        const fenced = Boolean(className) || value.includes('\n');
        return fenced ? <CodeBlock className={className}>{codeChildren}</CodeBlock> : <code className={className}>{codeChildren}</code>;
      },
      pre: ({ children: preChildren }) => <>{preChildren}</>,
    }}
  >{children || ''}</ReactMarkdown>;
}
