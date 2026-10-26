/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DataView } from '@kbn/data-views-plugin/public';
import type { AggregateQuery, Query, TimeRange } from '@kbn/es-query';
import type { DataTableRecord } from '@kbn/discover-utils/types';
import type { DataSource } from '@kbn/data-source';
import type { EbtClickAttrs } from '@kbn/ebt-click';
import type { SerializableRecord } from '@kbn/utility-types';
import type { ZodTypeAny } from '@kbn/zod';
import type { ReactElement, ReactNode } from 'react';
import type {
  EuiBadgeProps,
  EuiContextMenuPanelDescriptor,
  EuiContextMenuPanelItemDescriptor,
  IconType,
} from '@elastic/eui';
import type { DocViewsRegistry } from './doc_views_registry';

/*
 * Structured descriptors for the flyout header/footer. Profiles describe WHAT goes in the header and
 * footer as structured parts; the flyout is the single layer that maps these onto @kbn/flyout-template
 * parts. This replaces arbitrary JSX injection (the deprecated renderHeader/renderFooter) so flyout
 * chrome stays consistent. The structure is fixed; leaf values stay ReactNode, so interactive widgets
 * (popovers, avatars, switches) remain possible as block/menu content.
 */

/** A badge rendered in the flyout header (e.g. severity, document category). */
export interface DocViewerHeaderBadge {
  id: string;
  label: ReactNode;
  color: EuiBadgeProps['color'];
  iconType?: IconType;
  tooltip?: ReactNode;
}

/** A titled key/value block in the header. `value` may be interactive content. */
export interface DocViewerHeaderBlock {
  id: string;
  /** Plain-text label for the block. */
  title: string;
  /** Block value — arbitrary content, interactive widgets allowed. */
  value: ReactNode;
  /**
   * `meta` → compact inline key/value row (template `Header.MetaBlock`);
   * `info` → larger titled-value grid cell (template `Header.InfoBlock`). Defaults to `meta`.
   * Styling of the value (color, size) is expressed in the `value` node itself.
   */
  variant?: 'meta' | 'info';
}

/** Structured flyout header. The title text itself stays on `DocViewerExtension.title`. */
export interface DocViewerHeader {
  /** Icon/tooltip adornments for the (separately provided) title. */
  titleIcon?: IconType;
  titleTooltip?: ReactNode;
  /** Secondary text under the title (timestamp, "First seen", …). */
  description?: ReactNode;
  /** Header badges. */
  badges?: DocViewerHeaderBadge[];
  /** Titled key/value blocks (risk score, status, assignees, …). */
  blocks?: DocViewerHeaderBlock[];
}

/** A footer action — renders a button, never an anchor (matches the template). */
export interface DocViewerFooterAction {
  id: string;
  label: string;
  onClick: () => void;
  iconType?: IconType;
  isDisabled?: boolean;
  /** Shown on hover/focus, e.g. to explain why the action is disabled. */
  tooltip?: ReactNode;
}

/** Narrows an EUI menu item so its `name` is plain text (interactive items break menu keyboard nav). */
type WithStringName<T> = T extends { name: ReactNode } ? Omit<T, 'name'> & { name: string } : T;

/** A single footer-menu item: a string-named action or a separator (no self-rendered items). */
export type DocViewerFooterMenuItem = WithStringName<
  Extract<EuiContextMenuPanelItemDescriptor, { renderItem?: never }>
>;

/**
 * A (sub-)panel in a footer action menu. Mirrors the shared flyout-template menu-panel shape so the
 * flyout can pass it straight through, without this package depending on `@kbn/flyout-template`.
 */
export type DocViewerFooterMenuPanel = Omit<
  EuiContextMenuPanelDescriptor,
  'content' | 'items' | 'title'
> & {
  items: DocViewerFooterMenuItem[];
  /** Sub-menu title — required when users navigate into the panel (used for the "Back" button). */
  title?: string;
  content?: never;
};

/** A "take action" menu: a trigger button opening an EuiContextMenu. */
export interface DocViewerFooterActionMenu {
  /** Trigger button text (e.g. "Take action"). */
  label: string;
  /** Context-menu panels; items use string `name`s (no self-rendered items). */
  panels: DocViewerFooterMenuPanel[];
  isDisabled?: boolean;
  isLoading?: boolean;
}

/**
 * Structured flyout footer. Mirrors the template's footer rule: an optional `secondaryAction`
 * button plus a primary slot that is either a take-action `actionMenu` or a `primaryAction`
 * button — never a menu and a primary button at once. Pairing a `secondaryAction` with an
 * `actionMenu` is allowed (e.g. Security's "Ask AI Assistant" button beside a "Take action"
 * menu), so the structured contract is as expressive as the template's
 * `SecondaryAction` + `PrimaryActionMenu` and no arbitrary component injection is needed.
 */
export type DocViewerFooter =
  | {
      actionMenu: DocViewerFooterActionMenu;
      secondaryAction?: DocViewerFooterAction;
      primaryAction?: never;
    }
  | {
      primaryAction: DocViewerFooterAction;
      secondaryAction?: DocViewerFooterAction;
      actionMenu?: never;
    };

/**
 * Represents the restorable state for all doc viewer tabs, keyed by tab ID.
 * Each tab can store its own state as needed.
 */
export type DocViewerTabsState = Record<string, unknown>;

export interface DocViewerRestorableState {
  /**
   * Represents the restorable state for all doc viewer tabs, keyed by tab ID.
   * Each tab can store its own state as needed.
   */
  docViewerTabsState?: DocViewerTabsState;
  /**
   * Used to dedupe initial `unified_doc_viewer_viewed` event when restoring state.
   */
  initialDocViewerViewedEventKey?: string;
}

/**
 * The URL-shareable subset of the doc viewer's state. It is a projection of the (larger)
 * {@link DocViewerRestorableState}: only tabs that declare a `shareableStateSchema` contribute, and
 * only the fields that schema allows.
 */
export interface DocViewerShareableState extends SerializableRecord {
  /** The selected doc viewer tab id. */
  selectedTabId?: string;
  /**
   * Per-tab shareable slices keyed by doc view id, each projected through that tab's
   * `shareableStateSchema`.
   */
  tabsState?: SerializableRecord;
}

export interface FieldMapping {
  filterable?: boolean;
  scripted?: boolean;
  rowCount?: number;
  type: string;
  esTypes?: string[];
  name: string;
  displayName?: string;
}

export type DocViewFilterFn = (
  mapping: FieldMapping | string | undefined,
  value: unknown,
  mode: '+' | '-'
) => void;

export interface DocViewActions {
  openInNewTab?: (params: {
    query?: Query | AggregateQuery;
    tabLabel?: string;
    timeRange?: TimeRange;
  }) => void;
  updateESQLQuery?: (queryOrUpdater: string | ((prevQuery: string) => string)) => void;
}

export interface DocViewRenderProps {
  hit: DataTableRecord;
  dataView: DataView;
  columns?: string[];
  /**
   * The data source of the hit. For ES|QL results, column types are read from it;
   * otherwise they are derived from the dataView field types.
   */
  dataSource?: DataSource;
  textBasedHits?: DataTableRecord[];
  hideActionsColumn?: boolean;
  filter?: DocViewFilterFn;
  onAddColumn?: (columnName: string) => void;
  onRemoveColumn?: (columnName: string) => void;
  docViewsRegistry?: DocViewsRegistry | ((prevRegistry: DocViewsRegistry) => DocViewsRegistry);
  decreaseAvailableHeightBy?: number;
  hideFilteringOnComputedColumns?: boolean;
}

export type DocViewerComponent = React.FC<DocViewRenderProps>;

/**
 * Props a doc view uses to participate in the doc viewer's restorable/shareable state channel: seed
 * from `initialState` on mount, and report changes via `onInitialStateChange`. Provider-agnostic —
 * a tab may satisfy it with `withRestorableState` / `useRestorableState` from `@kbn/restorable-state`
 * (the convenient default), or wire the props itself; it does not have to depend on that package.
 */
export interface DocViewRestorableStateProps<TState extends object = object> {
  /** State to seed the tab with on mount, from local restore or a shared-link deep link. */
  initialState?: Partial<TState>;
  /** Reports the tab's current state so the host can persist it (locally and/or in the URL). */
  onInitialStateChange?: (state: Partial<TState>) => void;
}

export type DocViewRenderFunction<TState extends object = object> = (
  props: DocViewRenderProps & DocViewRestorableStateProps<TState>
) => ReactElement;

export interface DocView<TState extends object = object> {
  id: string;
  order: number;
  title: string;
  enabled?: boolean;
  /** Optional element rendered before the tab title (e.g. a technical preview badge). */
  prepend?: ReactElement;
  /**
   * Optional EBT click attributes (`data-ebt-*`) for the rendered tab button.
   * Every tab gets auto-generated attributes (`data-ebt-action` derived from the
   * tab id, e.g. `doc_view_table` -> `viewTable`); set this field only to
   * override them (e.g. to share an action name with equivalent tabs on other
   * surfaces).
   */
  ebt?: EbtClickAttrs;
  /**
   * Optional schema describing the URL-shareable subset of this tab's state. When set, the doc viewer
   * projects the tab's reported state through it for deep links and validates restored values against
   * it. Keep the schema bounded (e.g. `.max()` on strings/arrays) and evolve it additively so that
   * older shared links degrade gracefully rather than breaking.
   */
  shareableStateSchema?: ZodTypeAny;
  render: DocViewRenderFunction<TState>;
}
