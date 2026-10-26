/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ReactNode } from 'react';
import React, { useCallback, useMemo, useRef } from 'react';
import type { DocViewerProps, ElasticRequestState } from '@kbn/unified-doc-viewer';
import { DOC_VIEWER_FLYOUT_HISTORY_KEY } from '@kbn/unified-doc-viewer';
import { i18n } from '@kbn/i18n';
import type { DataView } from '@kbn/data-views-plugin/public';
import type { EuiFlyoutMenuAction, EuiFlyoutProps } from '@elastic/eui';
import { EuiSpacer, isDOMNode, keys, useEuiTheme, useIsWithinMinBreakpoint } from '@elastic/eui';
import { FlyoutTemplate } from '@kbn/flyout-template';
import type { DataTableRecord } from '@kbn/discover-utils/types';
import type { DataSource } from '@kbn/data-source';
import useLocalStorage from 'react-use/lib/useLocalStorage';
import type { ToastsStart } from '@kbn/core-notifications-browser';
import useObservable from 'react-use/lib/useObservable';
import type { ChromeStart } from '@kbn/core/public';
import type { DocViewFilterFn, DocViewRenderProps } from '@kbn/unified-doc-viewer/types';
import { FlyoutHistoryKeyContext } from './flyout_history_key_context';
import { OriginDocTypeContext } from './origin_doc_type_context';
import { UnifiedDocViewer } from '../lazy_doc_viewer';
import { useFlyoutA11y } from './use_flyout_a11y';
import { UnresolvedDocument, type RequestStateMeta } from './unresolved_document';

export interface UnifiedDocViewerFlyoutProps
  extends Pick<
    DocViewerProps,
    'initialTabId' | 'onUpdateSelectedTabId' | 'initialShareableState' | 'onShareableStateChange'
  > {
  docViewerRef?: DocViewerProps['ref'];
  'data-test-subj'?: string;
  flyoutTitle?: string;
  flyoutDefaultWidth?: EuiFlyoutProps['size'];
  /**
   * Actions rendered in the flyout menu bar (leading side), e.g. "View single document" /
   * "View surrounding documents". Each may be a button or, with `href`, a link.
   */
  flyoutLeadingActions?: EuiFlyoutMenuAction[];
  flyoutMenuTrailingActions?: EuiFlyoutMenuAction[];
  flyoutType?: 'push' | 'overlay';
  flyoutWidthLocalStorageKey?: string;
  originDocType?: string;
  services: {
    toastNotifications?: ToastsStart;
    chrome: ChromeStart;
  };
  docViewsRegistry?: DocViewRenderProps['docViewsRegistry'];
  isEsqlQuery: boolean;
  columns: string[];
  dataSource?: DataSource;
  /** The expanded document, or undefined while a shared link resolves. */
  hit?: DataTableRecord;
  /** Request state rendered when the document is unavailable. */
  requestState?: ElasticRequestState;
  /** Identifies the document behind `requestState`, shown when it can't be resolved. */
  requestStateMeta?: RequestStateMeta;
  /** Shown at the top of the body when the document is absent from the current results. */
  notice?: ReactNode;
  hits?: DataTableRecord[];
  dataView: DataView;
  hideFilteringOnComputedColumns?: boolean;
  initialDocViewerState?: DocViewerProps['initialState'];
  onInitialDocViewerStateChange?: DocViewerProps['onInitialStateChange'];
  renderCustomHeader?: (props: DocViewRenderProps) => React.ReactElement;
  renderCustomFooter?: (props: DocViewRenderProps) => React.ReactElement;
  setExpandedDoc: (doc?: DataTableRecord) => void;
  onClose: () => void;
  onAddColumn: (column: string) => void;
  onRemoveColumn: (column: string) => void;
  onFilter?: DocViewFilterFn;
}

function getIndexByDocId(hits: DataTableRecord[], id: string) {
  return hits.findIndex((h) => {
    return h.id === id;
  });
}

export const FLYOUT_WIDTH_KEY = 'unifiedDocViewer:flyoutWidth';

// matches project layout, but it's a private value, TODO refactor within https://github.com/elastic/kibana/issues/250359
const PROJECT_VIEW_MARGIN_BOTTOM = 8;

/**
 * Flyout displaying an expanded row details
 */
export function UnifiedDocViewerFlyout({
  docViewerRef,
  'data-test-subj': dataTestSubj,
  flyoutTitle,
  flyoutDefaultWidth,
  flyoutLeadingActions,
  flyoutMenuTrailingActions,
  flyoutType,
  flyoutWidthLocalStorageKey,
  originDocType,
  services,
  docViewsRegistry,
  isEsqlQuery,
  columns,
  dataSource,
  hit,
  requestState,
  requestStateMeta,
  notice,
  hits,
  dataView,
  hideFilteringOnComputedColumns,
  initialTabId,
  initialDocViewerState,
  renderCustomHeader,
  renderCustomFooter,
  setExpandedDoc,
  onClose,
  onAddColumn,
  onRemoveColumn,
  onFilter,
  onInitialDocViewerStateChange,
  onUpdateSelectedTabId,
  initialShareableState,
  onShareableStateChange,
}: UnifiedDocViewerFlyoutProps) {
  const { euiTheme } = useEuiTheme();
  const isXlScreen = useIsWithinMinBreakpoint('xl');
  const chromeStyle = useObservable(services.chrome.getChromeStyle$(), 'classic');
  const isProjectStyle = chromeStyle === 'project';
  const DEFAULT_WIDTH = euiTheme.base * 34;
  const defaultWidth = flyoutDefaultWidth ?? DEFAULT_WIDTH; // Give enough room to search bar to not wrap
  const [flyoutWidth, setFlyoutWidth] = useLocalStorage(
    flyoutWidthLocalStorageKey ?? FLYOUT_WIDTH_KEY,
    defaultWidth
  );
  const flyoutWidthRef = useRef(flyoutWidth ?? defaultWidth);
  const minWidth = euiTheme.base * 24;
  const maxWidth = euiTheme.breakpoint.xl;
  // Get actual hit with updated highlighted searches
  const foundHit = useMemo(() => hits?.find(({ id }) => id === hit?.id), [hit, hits]);
  const actualHit = useMemo(() => foundHit ?? hit, [foundHit, hit]);
  const pageCount = useMemo<number>(() => (hits && foundHit ? hits.length : 0), [foundHit, hits]);
  const activePage = useMemo<number>(() => {
    if (!hits || !hit || pageCount <= 1) {
      return -1;
    }

    return getIndexByDocId(hits, hit.id);
  }, [hits, hit, pageCount]);

  const setPage = useCallback(
    (index: number) => {
      if (hits && hits[index]) {
        setExpandedDoc(hits[index]);
      }
    },
    [hits, setExpandedDoc]
  );

  const onKeyDown = useCallback(
    (ev: React.KeyboardEvent) => {
      if (ev.target instanceof HTMLElement && ev.target.closest('.euiDataGrid__content')) {
        // ignore events triggered from the data grid
        return;
      }

      if (isDOMNode(ev.target) && ev.currentTarget.contains(ev.target) && ev.key === keys.ESCAPE) {
        ev.preventDefault();
        ev.stopPropagation();
        onClose();
      }

      if (ev.target instanceof HTMLInputElement) {
        // ignore events triggered from the search input
        return;
      }

      const isTabButton = (ev.target as HTMLElement).getAttribute('role') === 'tab';
      if (isTabButton) {
        // ignore events triggered when the tab buttons are focused
        return;
      }

      const isResizableButton =
        (ev.target as HTMLElement).getAttribute('data-test-subj') === 'euiResizableButton';
      if (isResizableButton) {
        // ignore events triggered when the resizable button is focused
        return;
      }

      if (ev.key === keys.ARROW_LEFT || ev.key === keys.ARROW_RIGHT) {
        ev.preventDefault();
        ev.stopPropagation();
        setPage(activePage + (ev.key === keys.ARROW_RIGHT ? 1 : -1));
      }
    },
    [activePage, onClose, setPage]
  );

  const docViewRenderProps = useMemo<DocViewRenderProps | undefined>(
    () =>
      actualHit && {
        hit: actualHit,
        dataView,
        columns,
        dataSource,
        textBasedHits: isEsqlQuery ? hits : undefined,
        filter: onFilter,
        onAddColumn,
        onRemoveColumn,
        docViewsRegistry,
        decreaseAvailableHeightBy: isProjectStyle
          ? euiTheme.base + PROJECT_VIEW_MARGIN_BOTTOM
          : euiTheme.base,
        hideFilteringOnComputedColumns,
      },
    [
      actualHit,
      dataView,
      columns,
      dataSource,
      isEsqlQuery,
      hits,
      onFilter,
      onAddColumn,
      onRemoveColumn,
      docViewsRegistry,
      isProjectStyle,
      euiTheme.base,
      hideFilteringOnComputedColumns,
    ]
  );

  const defaultFlyoutTitle = isEsqlQuery
    ? i18n.translate('unifiedDocViewer.flyout.docViewerEsqlDetailHeading', {
        defaultMessage: 'Result',
      })
    : i18n.translate('unifiedDocViewer.flyout.docViewerDetailHeading', {
        defaultMessage: 'Document',
      });
  const currentFlyoutTitle = flyoutTitle ?? defaultFlyoutTitle;
  const { a11yProps, screenReaderDescription } = useFlyoutA11y({ isXlScreen });
  // FlyoutTemplate owns the underlying flyout ref, so the ref-based XL auto-focus can't be wired
  // through its public API yet (SharedUX gap G4). The remaining a11y attributes still pass through.
  const { ref: _flyoutRef, ...flyoutA11yProps } = a11yProps;

  // Shared history key for the EUI flyout manager: this symbol groups the
  // Document Viewer flyout and any nested flyouts (e.g. Trace Waterfall) into
  // the same back-button navigation history, enabling "Back" to return the user
  // from the Trace Waterfall to the Document Viewer.
  const historyKey = DOC_VIEWER_FLYOUT_HISTORY_KEY;

  return (
    <FlyoutHistoryKeyContext.Provider value={historyKey}>
      <OriginDocTypeContext.Provider value={originDocType}>
        <FlyoutTemplate
          session="start"
          historyKey={historyKey}
          flyoutMenuProps={{
            title: currentFlyoutTitle,
            'data-test-subj': 'docViewerRowDetailsTitle',
            hideTitle: false,
            leadingActions: flyoutLeadingActions,
            trailingActions: flyoutMenuTrailingActions,
            // prev/next document navigation (replaces the old EuiPagination subheader)
            pagination:
              activePage !== -1
                ? {
                    currentIndex: activePage,
                    total: pageCount,
                    onPrevious: () => setPage(activePage - 1),
                    onNext: () => setPage(activePage + 1),
                  }
                : undefined,
          }}
          className="DiscoverFlyout" // used to override the z-index of the flyout from SecuritySolution
          onClose={onClose}
          type={flyoutType ?? 'push'}
          // workaround for remounting EUI flyout on resize if session prop is set to 'start'
          size={flyoutWidthRef.current}
          pushMinBreakpoint="xl"
          data-test-subj={dataTestSubj ?? 'docViewerFlyout'}
          onKeyDown={onKeyDown}
          ownFocus={true}
          minWidth={minWidth}
          maxWidth={maxWidth}
          resizable={true}
          onResize={setFlyoutWidth}
          css={{
            maxWidth: `${isXlScreen ? `calc(100vw - ${DEFAULT_WIDTH}px)` : '90vw'} !important`,
          }}
          aria-label={currentFlyoutTitle}
          {...flyoutA11yProps}
        >
          <FlyoutTemplate.Body>
            {screenReaderDescription}
            {activePage === -1 && notice && (
              <>
                {notice}
                <EuiSpacer size="m" />
              </>
            )}
            {actualHit && docViewRenderProps ? (
              <>
                {renderCustomHeader && (
                  <>
                    {renderCustomHeader(docViewRenderProps)}
                    <EuiSpacer size="m" />
                  </>
                )}
                <UnifiedDocViewer
                  key={actualHit.id}
                  ref={docViewerRef}
                  initialTabId={initialTabId}
                  initialState={initialDocViewerState}
                  onInitialStateChange={onInitialDocViewerStateChange}
                  onUpdateSelectedTabId={onUpdateSelectedTabId}
                  initialShareableState={initialShareableState}
                  onShareableStateChange={onShareableStateChange}
                  originDocType={originDocType}
                  {...docViewRenderProps}
                />
                {/* FlyoutTemplate.Footer only accepts structured action parts, so a profile-supplied
                    arbitrary footer (e.g. Security's alert/attack bars) can't be a sticky template
                    footer yet. Rendered inline at the end of the body as an interim until the SharedUX
                    footer escape-hatch lands (gap G3). */}
                {renderCustomFooter && (
                  <>
                    <EuiSpacer size="m" />
                    {renderCustomFooter(docViewRenderProps)}
                  </>
                )}
              </>
            ) : (
              <UnresolvedDocument requestState={requestState} requestStateMeta={requestStateMeta} />
            )}
          </FlyoutTemplate.Body>
        </FlyoutTemplate>
      </OriginDocTypeContext.Provider>
    </FlyoutHistoryKeyContext.Provider>
  );
}
