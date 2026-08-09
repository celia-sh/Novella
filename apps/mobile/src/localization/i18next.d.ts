import 'i18next';

import type { zhCNResources } from './resources.ts';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    returnNull: false;
    resources: typeof zhCNResources;
  }
}
