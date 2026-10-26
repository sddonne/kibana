/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ForwardedRef, ReactElement, ReactNode, RefAttributes } from 'react';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import useLocalStorage from 'react-use/lib/useLocalStorage';
import type { AnalyticsServiceStart } from '@kbn/core/public';
import { getDocViewTabEbtProps } from './get_doc_view_tab_ebt_props';
import { DocViewerTab } from './doc_viewer_tab';
import type { DocView, DocViewRenderProps, DocViewerShareableState } from '../../types';
import { useDocViewerTabViewedEvent } from '../../analytics';
import { useRestorableState, useRestorableStateValue } from './restorable_state';
import { capShareableState, projectShareableTabsState } from './shareable_state';

export const INITIAL_TAB = 'unifiedDocViewer:initialTab';

export interface InternalDocViewerApi {
  setSelectedTabId: (tabId: string) => void;
}

export interface InternalDocViewerProps
  extends DocViewRenderProps,
    RefAttributes<InternalDocViewerApi>,
    Pick<AnalyticsServiceStart, 'reportEvent'> {
  docViews: DocView[];
  initialTabId?: DocView['id'];
  onUpdateSelectedTabId?: (tabId: string | undefined) => void;
  /**
   * Emits the URL-shareable projection of the doc viewer state (selected tab + per-tab shareable
   * slices) whenever it changes, so a host can persist it in a deep link.
   */
  onShareableStateChange?: (state: DocViewerShareableState) => void;
  originDocType?: string;
}

/**
 * A single doc viewer tab, described independently of how it is presented: the standalone
 * `DocViewer` feeds these to `EuiTabbedContent`, while the flyout maps them onto the flyout
 * template's tab API. `content` is the tab's panel; only the selected tab's panel is mounted.
 */
export interface DocViewerTabDescriptor {
  /** Full id, used both to drive selection and to persist the active tab in local storage. */
  id: string;
  /** The doc view's own id (without the internal prefix). */
  originalId: string;
  /** Tab label. */
  name: string;
  /** Optional element rendered before the tab title (e.g. a technical preview badge). */
  prepend?: ReactNode;
  'data-test-subj': string;
  /** EBT click attributes (`data-ebt-*`) applied to the tab button. */
  ebtProps: ReturnType<typeof getDocViewTabEbtProps>;
  /** The tab's panel content. */
  content: ReactElement;
}

export interface UseDocViewerTabsResult {
  /** The enabled doc views as renderer-agnostic tab descriptors, in registry order. */
  tabs: DocViewerTabDescriptor[];
  /** The active tab, falling back to the first tab. Undefined only when there are no tabs. */
  selectedTab: DocViewerTabDescriptor | undefined;
  /** Select a tab by its full id and persist it as the initial tab. */
  selectTab: (fullTabId: string) => void;
}

export const getFullTabId = (tabId: string) => `kbn_doc_viewer_tab_${tabId}`;
export const getOriginalTabId = (fullTabId: string) => fullTabId.replace('kbn_doc_viewer_tab_', '');

/**
 * Owns the doc viewer's tab model and selected-tab state — local-storage persistence, initial-tab
 * resolution, the restorable/shareable state channel, and the viewed-tab analytics event —
 * independently of how the tabs are rendered. Consumed by both the standalone `DocViewer`
 * (`EuiTabbedContent`) and the flyout (the flyout template's tab API). Must run within the doc
 * viewer's restorable-state provider.
 */
export const useDocViewerTabs = (
  {
    docViews,
    initialTabId,
    onUpdateSelectedTabId,
    onShareableStateChange,
    reportEvent,
    originDocType,
    ...renderProps
  }: InternalDocViewerProps,
  ref: ForwardedRef<InternalDocViewerApi>
): UseDocViewerTabsResult => {
  const tabs = docViews
    .filter(({ enabled }) => enabled) // Filter out disabled doc views
    .map(
      (docView: DocView): DocViewerTabDescriptor => ({
        id: getFullTabId(docView.id), // `id` value is used to persist the selected tab in localStorage
        originalId: docView.id,
        name: docView.title,
        prepend: docView.prepend,
        'data-test-subj': `docViewerTab-${docView.id}`,
        ebtProps: getDocViewTabEbtProps(docView),
        content: (
          <DocViewerTab
            key={`${renderProps.hit.id}_${docView.id}`}
            docView={docView}
            renderProps={renderProps}
          />
        ),
      })
    );

  const [storedInitialTabId, setInitialTabId] = useLocalStorage<string>(INITIAL_TAB);
  const [selectedTabId, setSelectedTabId] = useState<string | undefined>(
    initialTabId ? getFullTabId(initialTabId) : storedInitialTabId
  );
  const selectedTab =
    (selectedTabId ? tabs.find(({ id }) => id === selectedTabId) : undefined) ?? tabs.at(0);

  const selectTab = useCallback(
    (fullTabId: string) => {
      setSelectedTabId(fullTabId);
      setInitialTabId(fullTabId); // Persist the selected tab in localStorage
    },
    [setInitialTabId]
  );

  useEffect(() => {
    onUpdateSelectedTabId?.(selectedTabId ? getOriginalTabId(selectedTabId) : undefined);
  }, [onUpdateSelectedTabId, selectedTabId]);

  useImperativeHandle(
    ref,
    () => ({
      setSelectedTabId: (tabId: string) => selectTab(getFullTabId(tabId)),
    }),
    [selectTab]
  );

  const [initialDocViewerViewedEventKey, setInitialDocViewerViewedEventKey] = useRestorableState(
    'initialDocViewerViewedEventKey',
    undefined
  );

  // Emit the URL-shareable projection of the doc viewer state whenever the selected tab or a tab's
  // shareable slice changes.
  const docViewerTabsState = useRestorableStateValue('docViewerTabsState');
  const lastEmittedShareableStateRef = useRef<string>();
  const selectedOriginalTabId = selectedTab ? getOriginalTabId(selectedTab.id) : undefined;

  useEffect(() => {
    if (!onShareableStateChange) {
      return;
    }

    const shareableState = capShareableState({
      selectedTabId: selectedOriginalTabId,
      tabsState: projectShareableTabsState(docViews, docViewerTabsState),
    });

    const serialized = JSON.stringify(shareableState);

    if (serialized === lastEmittedShareableStateRef.current) {
      return;
    }

    lastEmittedShareableStateRef.current = serialized;
    onShareableStateChange(shareableState);
  }, [onShareableStateChange, docViews, docViewerTabsState, selectedOriginalTabId]);

  useDocViewerTabViewedEvent({
    reportEvent,
    tabId: selectedTab ? getOriginalTabId(selectedTab.id) : undefined,
    originDocType,
    hit: renderProps.hit,
    initialEventKey: initialDocViewerViewedEventKey,
    onEventKeyChange: setInitialDocViewerViewedEventKey,
  });

  return { tabs, selectedTab, selectTab };
};
