/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { forwardRef } from 'react';
import type { DocViewerApi, DocViewerProps } from '@kbn/unified-doc-viewer';
import { DocViewer } from '@kbn/unified-doc-viewer';

import { getUnifiedDocViewerServices } from '../../plugin';
import { useResolvedDocViews } from './use_doc_views_registry';

export const UnifiedDocViewer = forwardRef<
  DocViewerApi,
  Omit<DocViewerProps, 'docViews' | 'reportEvent'>
>(({ docViewsRegistry, ...props }, ref) => {
  const { analytics } = getUnifiedDocViewerServices();
  const docViews = useResolvedDocViews(docViewsRegistry);

  return <DocViewer ref={ref} docViews={docViews} reportEvent={analytics.reportEvent} {...props} />;
});
