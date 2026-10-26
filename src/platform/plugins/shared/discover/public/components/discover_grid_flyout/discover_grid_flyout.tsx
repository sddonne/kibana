/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useMemo } from 'react';
import type { DataView } from '@kbn/data-views-plugin/public';
import type { AggregateQuery, Filter, Query } from '@kbn/es-query';
import { isOfAggregateQueryType } from '@kbn/es-query';
import type { DataTableRecord } from '@kbn/discover-utils/types';
import type { DocViewFilterFn } from '@kbn/unified-doc-viewer/types';
import type { DataSource } from '@kbn/data-source';
import type { DocViewerProps, DocViewsRegistry } from '@kbn/unified-doc-viewer';
import { DiscoverFlyouts, dismissAllFlyoutsExceptFor } from '@kbn/discover-utils';
import type { UnifiedDocViewerFlyoutProps } from '@kbn/unified-doc-viewer-plugin/public';
import { UnifiedDocViewerFlyout } from '@kbn/unified-doc-viewer-plugin/public';
import type { EuiFlyoutMenuAction } from '@elastic/eui';
import { useDiscoverServices } from '../../hooks/use_discover_services';
import { useFlyoutActions } from './use_flyout_actions';
import { DocumentType, useProfileAccessor } from '../../context_awareness';
import { recordHasContext } from '../../context_awareness/profiles_manager/record_has_context';

export const FLYOUT_WIDTH_KEY = 'discover:flyoutWidth';

export interface DiscoverGridFlyoutProps
  extends Pick<
    UnifiedDocViewerFlyoutProps,
    | 'initialDocViewerState'
    | 'onInitialDocViewerStateChange'
    | 'onUpdateSelectedTabId'
    | 'initialShareableState'
    | 'onShareableStateChange'
    | 'requestState'
    | 'requestStateMeta'
    | 'notice'
    | 'flyoutMenuTrailingActions'
    | 'flyoutType'
  > {
  savedSearchId?: string;
  filters?: Filter[];
  query?: Query | AggregateQuery;
  columns: string[];
  dataSource?: DataSource;
  hit?: DataTableRecord;
  hits?: DataTableRecord[];
  dataView: DataView;
  initialTabId?: string;
  docViewerRef?: DocViewerProps['ref'];
  onAddColumn: (column: string) => void;
  onClose: () => void;
  onFilter?: DocViewFilterFn;
  onRemoveColumn: (column: string) => void;
  setExpandedDoc: (
    doc?: DataTableRecord,
    options?: { initialTabId?: string; initialTabState?: object }
  ) => void;
  hideFilteringOnComputedColumns?: boolean;
}

const getOriginDocType = (record: DataTableRecord | undefined): DocumentType =>
  recordHasContext(record) ? record.context.type : DocumentType.Default;

/**
 * Flyout displaying an expanded Elasticsearch document
 */
export function DiscoverGridFlyout({
  hit,
  hits,
  dataView,
  columns,
  dataSource,
  savedSearchId,
  filters,
  query,
  initialTabId,
  docViewerRef,
  onFilter,
  onClose,
  onRemoveColumn,
  onAddColumn,
  setExpandedDoc,
  initialDocViewerState,
  onInitialDocViewerStateChange,
  onUpdateSelectedTabId,
  initialShareableState,
  onShareableStateChange,
  hideFilteringOnComputedColumns,
  requestState,
  requestStateMeta,
  notice,
  flyoutMenuTrailingActions,
  flyoutType,
}: DiscoverGridFlyoutProps) {
  const services = useDiscoverServices();
  const isEsqlQuery = isOfAggregateQueryType(query);
  // Get actual hit with updated highlighted searches
  const actualHit = useMemo(() => hits?.find(({ id }) => id === hit?.id) || hit, [hit, hits]);

  const { flyoutActions } = useFlyoutActions({
    dataView,
    rowIndex: actualHit?.raw._index,
    rowId: actualHit?.raw._id,
    columns,
    filters,
    savedSearchId,
  });

  // The "View single document" / "View surrounding documents" actions now live in the flyout menu
  // bar instead of a bespoke subheader, so map them to EuiFlyoutMenuAction descriptors. Items with
  // an `href` render as links (open-in-new-tab preserved); the rest render as buttons.
  const flyoutLeadingActions = useMemo<EuiFlyoutMenuAction[] | undefined>(() => {
    if (isEsqlQuery || !actualHit || flyoutActions.length === 0) {
      return undefined;
    }

    return flyoutActions.map((action) =>
      action.href
        ? {
            iconType: action.iconType,
            href: action.href,
            onClick: action.onClick,
            'aria-label': action.label,
            toolTipContent: action.helpText ?? action.label,
            'data-test-subj': action.dataTestSubj,
          }
        : {
            iconType: action.iconType,
            onClick: action.onClick,
            'aria-label': action.label,
            toolTipContent: action.helpText ?? action.label,
            'data-test-subj': action.dataTestSubj,
          }
    );
  }, [isEsqlQuery, actualHit, flyoutActions]);

  const getDocViewerAccessor = useProfileAccessor('getDocViewer', {
    record: actualHit,
  });
  const docViewer = useMemo(() => {
    const getDocViewer = getDocViewerAccessor(() => ({
      title: undefined,
      docViewsRegistry: (registry: DocViewsRegistry) => registry,
    }));

    // Document profiles cannot resolve a doc viewer until the record is available.
    return actualHit ? getDocViewer({ record: actualHit }) : undefined;
  }, [actualHit, getDocViewerAccessor]);

  useEffect(() => {
    dismissAllFlyoutsExceptFor(DiscoverFlyouts.docViewer);
  }, []);

  const originDocType = useMemo(() => getOriginDocType(actualHit), [actualHit]);

  return (
    <UnifiedDocViewerFlyout
      originDocType={originDocType}
      flyoutTitle={docViewer?.title}
      flyoutLeadingActions={flyoutLeadingActions}
      flyoutMenuTrailingActions={flyoutMenuTrailingActions}
      flyoutWidthLocalStorageKey={FLYOUT_WIDTH_KEY}
      flyoutType={flyoutType}
      services={services}
      docViewsRegistry={docViewer?.docViewsRegistry}
      getHeader={docViewer?.getHeader}
      getFooter={docViewer?.getFooter}
      renderCustomHeader={docViewer?.renderHeader}
      renderCustomFooter={docViewer?.renderFooter}
      isEsqlQuery={isEsqlQuery}
      hit={hit}
      requestState={requestState}
      requestStateMeta={requestStateMeta}
      notice={notice}
      hits={hits}
      dataView={dataView}
      columns={columns}
      dataSource={dataSource}
      onAddColumn={onAddColumn}
      onRemoveColumn={onRemoveColumn}
      onClose={onClose}
      onFilter={onFilter}
      setExpandedDoc={setExpandedDoc}
      initialTabId={initialTabId}
      docViewerRef={docViewerRef}
      initialDocViewerState={initialDocViewerState}
      onInitialDocViewerStateChange={onInitialDocViewerStateChange}
      onUpdateSelectedTabId={onUpdateSelectedTabId}
      initialShareableState={initialShareableState}
      onShareableStateChange={onShareableStateChange}
      hideFilteringOnComputedColumns={hideFilteringOnComputedColumns}
    />
  );
}

// eslint-disable-next-line import/no-default-export
export default DiscoverGridFlyout;
