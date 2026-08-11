import { createContext, type PropsWithChildren, useContext } from 'react';

export type NativeIconSet = 'platform' | 'tabler';

const NativeIconSetContext = createContext<NativeIconSet>('platform');

export function NativeIconSetProvider({
  children,
  value,
}: PropsWithChildren<{ value: NativeIconSet }>) {
  return (
    <NativeIconSetContext.Provider value={value}>
      {children}
    </NativeIconSetContext.Provider>
  );
}

export function useNativeIconSet(): NativeIconSet {
  return useContext(NativeIconSetContext);
}
