import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

export type ResourceBadge = { label: string; danger?: boolean };
export type ResourceTag = { label: string; on?: boolean; danger?: boolean; title?: string };
export type ResourceFact = { label: string; value: string; title?: string };

export type ResourceItem = {
  key: string;
  icon: ReactNode;
  name: string;
  badges?: ResourceBadge[];
  description?: string;
  meta?: string;
  haystack?: string;
  sourceKind?: string;
  enabled?: boolean;
  /** Optional status dimension for tabs; falls back to the enabled flag. */
  statusValue?: string;
  onToggle?: () => void | Promise<unknown>;
  detail: ReactNode;
};

type Tab = { value: string; label: string };
type Option = { value: string; label: string };

type ResourceListProps = {
  title: string;
  lead: ReactNode;
  headingActions?: ReactNode;
  tabs?: Tab[];
  sourceOptions?: Option[];
  sourceAriaLabel?: string;
  sourceDefaultLabel?: string;
  searchPlaceholder?: string;
  countNoun: string;
  items: ResourceItem[];
  emptyText: ReactNode;
  ariaLabel: string;
  className?: string;
};

/**
 * Shared single-column "resource row" surface. The markup intentionally reuses
 * the validated `.skill-row` classes so Skills / 工具 / 插件 / MCP / 智能体 all
 * render identically and follow the same skin, density and dark-mode tokens.
 */
export function ResourceList({
  title,
  lead,
  headingActions,
  tabs = [],
  sourceOptions = [],
  sourceAriaLabel = '按来源筛选',
  sourceDefaultLabel = '全部来源',
  searchPlaceholder = '搜索名称、说明或 ID',
  countNoun,
  items,
  emptyText,
  ariaLabel,
  className = '',
}: ResourceListProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(
    () => items.filter((item) =>
      (!query || [item.name, item.description, item.meta, item.haystack, ...(item.badges || []).map((badge) => badge.label)]
        .filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))
      && (!status || (item.statusValue ?? (item.enabled ? 'enabled' : 'disabled')) === status)
      && (!source || item.sourceKind === source)),
    [items, query, status, source],
  );

  return (
    <section className={`skill-settings resource-settings ${className}`.trim()} aria-label={ariaLabel}>
      <div className="settings-page-heading skill-page-heading">
        <div>
          <h3>{title}</h3>
          <p className="lead">{lead}</p>
        </div>
        {headingActions && <div className="skill-heading-actions">{headingActions}</div>}
      </div>

      {!!tabs.length && (
        <div className="skill-tabs" role="group" aria-label={`按状态筛选${countNoun}`}>
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.value}
              className={`skill-tab${status === tab.value ? ' active' : ''}`}
              aria-pressed={status === tab.value}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="resource-toolbar skill-toolbar" aria-label={`筛选${countNoun}`}>
        <label className="resource-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            aria-label={`搜索${countNoun}`}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {!!sourceOptions.length && (
          <select aria-label={sourceAriaLabel} value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">{sourceDefaultLabel}</option>
            {sourceOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        )}
        <span className="resource-count">{visible.length} / {items.length} {countNoun}</span>
      </div>

      <div className="skill-list">
        {visible.map((item, index) => {
          const open = expanded === item.key;
          const detailId = `resource-detail-${index}`;
          return (
            <article className={`skill-row${open ? ' is-open' : ''}`} key={item.key}>
              <div className="skill-row-main">
                <span className="skill-row-ico" aria-hidden>{item.icon}</span>
                <div className="skill-row-copy">
                  <div className="skill-row-title">
                    <strong>{item.name}</strong>
                    {(item.badges || []).map((badge, badgeIndex) => (
                      <span className={`skill-row-badge${badge.danger ? ' danger' : ''}`} key={`${badge.label}-${badgeIndex}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <p className="skill-row-desc">{item.description || '（暂无描述）'}</p>
                  {item.meta && <span className="skill-row-id">{item.meta}</span>}
                </div>
                <div className="skill-row-actions">
                  {typeof item.enabled === 'boolean' && item.onToggle && (
                    <button
                      type="button"
                      className={`mc-toggle${item.enabled ? ' on' : ''}`}
                      aria-pressed={item.enabled}
                      aria-label={`${item.name}：${item.enabled ? '已启用，点击停用' : '已停用，点击启用'}`}
                      onClick={() => void item.onToggle?.()}
                    >
                      <span className="mc-switch" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    className="skill-row-expand"
                    aria-expanded={open}
                    aria-controls={detailId}
                    aria-label={`${open ? '收起' : '展开'} ${item.name} 详情`}
                    onClick={() => setExpanded(open ? null : item.key)}
                  >
                    <ChevronDown size={16} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="skill-row-detail" id={detailId} hidden={!open}>{item.detail}</div>
            </article>
          );
        })}
        {!visible.length && <div className="extension-empty">{emptyText}</div>}
      </div>
    </section>
  );
}

export function ResourceFacts({ facts }: { facts: ResourceFact[] }) {
  return (
    <dl className="skill-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd title={fact.title || fact.value}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ResourceTags({ tags }: { tags: ResourceTag[] }) {
  return (
    <div className="mc-tags skill-detail-tags">
      {tags.map((tag, index) => (
        <span
          className={`mc-tag${tag.on ? ' on' : ''}${tag.danger ? ' danger' : ''}`}
          title={tag.title}
          key={`${tag.label}-${index}`}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}

export function ResourceActions({ children, note }: { children?: ReactNode; note?: ReactNode }) {
  return (
    <div className="skill-detail-actions">
      {children}
      {note && <span className="skill-readonly-note">{note}</span>}
    </div>
  );
}
