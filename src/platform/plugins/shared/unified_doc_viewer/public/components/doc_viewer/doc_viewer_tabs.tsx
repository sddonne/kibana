/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { forwardRef } from 'react';
import type { DocViewerTabsApi, DocViewerTabsProps } from '@kbn/unified-doc-viewer';
import { DocViewerTabs } from '@kbn/unified-doc-viewer';

import { getUnifiedDocViewerServices } from '../../plugin';
import { useResolvedDocViews } from './use_doc_views_registry';

/**
 * Same tab state as `UnifiedDocViewer`, but instead of rendering the tabs it exposes
 * `{ tabs, selectedTab, selectTab }` to a render-prop child, so a host can present them with its own
 * UI (e.g. the flyout template's tab bar + `Body.TabPanel`) while reusing the doc viewer's tab state.
 */
export const UnifiedDocViewerTabs = forwardRef<
  DocViewerTabsApi,
  Omit<DocViewerTabsProps, 'docViews' | 'reportEvent'>
>(({ docViewsRegistry, children, ...props }, ref) => {
  const { analytics } = getUnifiedDocViewerServices();
  const docViews = useResolvedDocViews(docViewsRegistry);

  return (
    <DocViewerTabs ref={ref} docViews={docViews} reportEvent={analytics.reportEvent} {...props}>
      {children}
    </DocViewerTabs>
  );
});
