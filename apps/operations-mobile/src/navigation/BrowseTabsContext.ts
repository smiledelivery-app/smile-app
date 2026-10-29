import { createContext } from 'react';

export const BrowseTabsContext = createContext<() => void>(() => undefined);
